import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import { Readable } from 'stream';
import * as crypto from 'crypto';
import 'multer';

@Injectable()
export class PersonaService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly key = process.env.ENCRYPTION_KEY; // Debe tener 32 caracteres

  constructor(private readonly prisma: PrismaService) {}

  // Utilidad para encriptar
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, Buffer.from(this.key as any), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    // Guardamos el vector de inicialización (iv) junto a la clave encriptada separados por ':'
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  // Utilidad para desencriptar
  private decrypt(text: string): string {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift() as any, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, Buffer.from(this.key as any), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }

  // 1. Buscar por DNI (Desencriptando la clave)
  async findByDni(dni: string) {
    if (!/^\d{8}$/.test(dni)) {
      throw new BadRequestException('El DNI debe tener exactamente 8 dígitos numéricos.');
    }

    const persona = await this.prisma.persona.findUnique({
      where: { dni },
    });

    if (!persona) {
      throw new BadRequestException(`No se encontró el DNI ${dni}`);
    }

    // Desencriptamos la clave antes de enviarla al frontend
    try {
      persona.clave = this.decrypt(persona.clave);
    } catch (error) {
      // Por si hay datos viejos sin encriptar en la base de datos
      persona.clave = 'Error: Clave no estaba encriptada correctamente'; 
    }

    return persona;
  }

  // 2. Procesar CSV o Excel (Encriptando la clave)
  async uploadFile(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No se ha proporcionado ningún archivo.');

    const workbook = new ExcelJS.Workbook();
    const personasToInsert: { dni: string; nombres: string; apellidos: string; clave: string }[] = [];

    try {
      if (file.originalname.endsWith('.csv')) {
        const stream = Readable.from(file.buffer);
        await workbook.csv.read(stream);
      } else {
        await workbook.xlsx.load(file.buffer as any);
      }

      const worksheet = workbook.worksheets[0];

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Saltar cabecera

        const dni = row.getCell(1).text?.trim();
        const nombres = row.getCell(2).text?.trim();
        const apellidos = row.getCell(3).text?.trim();
        const claveRaw = row.getCell(4).text?.trim();

        if (dni && nombres && apellidos && claveRaw) {
          // Encriptamos la clave antes de mandarla al array
          const claveEncriptada = this.encrypt(claveRaw);
          personasToInsert.push({ dni, nombres, apellidos, clave: claveEncriptada });
        }
      });

      // Borramos todos los registros actuales de la tabla (dejándola en 0)
      await this.prisma.persona.deleteMany({});

      const result = await this.prisma.persona.createMany({
        data: personasToInsert,
        skipDuplicates: true,
      });

      return {
        message: 'Archivo procesado correctamente',
        filasLeidas: personasToInsert.length,
        nuevosRegistros: result.count,
      };

    } catch (error:any) {
      throw new BadRequestException(`Error al procesar el archivo: ${error.message}`);
    }
  }

  // 3. Agregar/Actualizar datos sin borrar la tabla (Upsert)
  async appendFile(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No se ha proporcionado ningún archivo.');

    const workbook = new ExcelJS.Workbook();
    const personasToUpsert: { dni: string; nombres: string; apellidos: string; clave: string }[] = [];

    try {
      // Leer el archivo igual que en el método de subida
      if (file.originalname.endsWith('.csv')) {
        const stream = Readable.from(file.buffer);
        await workbook.csv.read(stream);
      } else {
        await workbook.xlsx.load(file.buffer as any);
      }

      const worksheet = workbook.worksheets[0];

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Saltar cabecera

        const dni = row.getCell(1).text?.trim();
        const nombres = row.getCell(2).text?.trim();
        const apellidos = row.getCell(3).text?.trim();
        const claveRaw = row.getCell(4).text?.trim();

        if (dni && nombres && apellidos && claveRaw) {
          // Encriptamos la clave nueva o actualizada
          const claveEncriptada = this.encrypt(claveRaw);
          personasToUpsert.push({ dni, nombres, apellidos, clave: claveEncriptada });
        }
      });

      // Usamos una transacción para ejecutar múltiples "upserts" a la vez
      const operaciones = personasToUpsert.map((persona) =>
        this.prisma.persona.upsert({
          where: { dni: persona.dni },
          update: {
            nombres: persona.nombres,
            apellidos: persona.apellidos,
            clave: persona.clave, // Actualiza con la nueva clave encriptada
          },
          create: {
            dni: persona.dni,
            nombres: persona.nombres,
            apellidos: persona.apellidos,
            clave: persona.clave, // Crea con la clave encriptada
          },
        })
      );

      // Ejecutamos todas las operaciones en la base de datos
      await this.prisma.$transaction(operaciones);

      return {
        message: 'Archivo procesado: Registros nuevos creados y existentes actualizados',
        totalProcesados: personasToUpsert.length,
      };

    } catch (error:any) {
      throw new BadRequestException(`Error al procesar el archivo: ${error.message}`);
    }
  }

  // 4. Obtener todos los registros con Paginación
  async findAll(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const take = limit;

    // Ejecutamos ambas consultas en paralelo
    const [total, personas] = await this.prisma.$transaction([
      this.prisma.persona.count(), // Cuenta el total exacto de registros en la BD
      this.prisma.persona.findMany({
        skip,
        take,
        orderBy: { apellidos: 'asc' }, // Opcional: los ordenamos alfabéticamente
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: personas,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

}
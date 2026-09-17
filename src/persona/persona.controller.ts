import { 
  Controller, 
  Post, // Cambiamos Get por Post
  Body, // Importamos Body en lugar de Param
  UploadedFile, 
  UseInterceptors,
  BadRequestException,
  UseGuards, 
  Query, // <-- Nuevo
  ParseIntPipe, // <-- Nuevo
  DefaultValuePipe,
  Get
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PersonaService } from './persona.service';
import { AuthGuard } from '@nestjs/passport'; 

@Controller('personas')
export class PersonaController {
  constructor(private readonly personaService: PersonaService) {}

  // 1. Endpoint seguro para buscar (POST en lugar de GET)
  @Post('buscar')
  async buscarPorDni(@Body('dni') dni: string) {
    if (!dni) {
      throw new BadRequestException('Debes enviar el dni en el cuerpo de la petición.');
    }
    return await this.personaService.findByDni(dni);
  }

  // 2. Endpoint de subida (se mantiene igual)
  @Post('upload')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('file'))
  async subirArchivo(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('El campo del archivo debe llamarse "file".');
    }
    return await this.personaService.uploadFile(file);
  }

  // 3. Nuevo Endpoint: Subir archivo para agregar o actualizar (No borra la tabla)
  @Post('agregar')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('file'))
  async agregarArchivo(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('El campo del archivo debe llamarse "file".');
    }
    return await this.personaService.appendFile(file);
  }

  // 4. Nuevo Endpoint: Listar todos los registros
  @Get('todos')
  @UseGuards(AuthGuard('jwt'))
  async obtenerTodos(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return await this.personaService.findAll(page, limit);
  }
}
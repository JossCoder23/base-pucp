import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  // 1. Crear el primer administrador
  async register(email: string, pass: string) {
    const existe = await this.prisma.administrador.findUnique({ where: { email } });
    if (existe) throw new ConflictException('El correo ya está registrado');

    const hashedPassword = await bcrypt.hash(pass, 10);
    const admin = await this.prisma.administrador.create({
      data: { email, password: hashedPassword },
    });
    return { message: 'Administrador creado', id: admin.id };
  }

  // 2. Login y generación de Token
  async login(email: string, pass: string) {
    const admin = await this.prisma.administrador.findUnique({ where: { email } });
    if (!admin) throw new UnauthorizedException('Credenciales inválidas');

    const isPasswordValid = await bcrypt.compare(pass, admin.password);
    if (!isPasswordValid) throw new UnauthorizedException('Credenciales inválidas');

    const payload = { email: admin.email, sub: admin.id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
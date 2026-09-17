import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PersonaModule } from './persona/persona.module';
import { PrismaModule } from './prisma/prisma.module'; // <-- Importación
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule, // <-- Agrégalo aquí
    PersonaModule, AuthModule,
  ],
})
export class AppModule {}
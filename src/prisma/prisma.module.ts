import { Global, Module } from '@nestjs/common';
// import { PersonaService } from './persona.service';
// import { PersonaController } from './persona.controller';
import { PrismaService } from '../prisma/prisma.service';
import { PersonaController } from '../persona/persona.controller';
import { PersonaService } from '../persona/persona.service';

@Global()
@Module({
  controllers: [PersonaController],
  providers: [PersonaService, PrismaService],
  exports: [PrismaService]
})
export class PrismaModule {}
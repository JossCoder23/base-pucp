import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    
    // Leemos el header personalizado que enviaremos desde el cliente o Postman
    const apiKey = request.headers['x-admin-key'];
    
    // Si la clave no coincide con la del .env, rechazamos la petición
    if (apiKey !== process.env.ADMIN_API_KEY) {
      throw new UnauthorizedException('Acceso denegado: No tienes permisos de administrador para subir archivos.');
    }

    return true;
  }
}
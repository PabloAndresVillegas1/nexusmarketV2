import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    try {
      // Una consulta trivial: si la DB no responde, esto lanza y lo
      // atrapamos abajo. No verificamos "el proceso está vivo" (eso ya lo
      // sabemos si esta ruta se ejecuta) sino "el servicio puede hacer su
      // trabajo real" — la distinción que le importa a un orquestador.
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return {
        status: 'ok',
        service: 'auth-service',
        db: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        service: 'auth-service',
        db: 'disconnected',
      });
    }
  }
}

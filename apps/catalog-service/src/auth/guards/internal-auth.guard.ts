import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Guard para comunicación SERVICIO-A-SERVICIO (no usuarios finales).
// En vez de un JWT de usuario, exige un secreto compartido que solo
// conocen los servicios del backend entre sí (nunca se expone al frontend).
// En producción esto normalmente se reemplaza por mTLS o un service mesh,
// pero el patrón de "canal separado para tráfico interno" es el mismo.
@Injectable()
export class InternalAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const providedKey = request.headers['x-internal-api-key'];
    const expectedKey = this.config.get<string>('INTERNAL_API_KEY');
    return Boolean(expectedKey) && providedKey === expectedKey;
  }
}

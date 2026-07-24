import { ConfigService } from '@nestjs/config';

export interface ProxyRoute {
  path: string;
  target: string;
}

// El mapa central del gateway: qué prefijo de URL va a qué microservicio.
// Añadir un servicio nuevo (ej. notification-service) es agregar una línea
// aquí — el resto del gateway no cambia.
//
// /orders y /payments comparten target: desde la v2.0, order-service y
// payment-service se fusionaron en orders-payments-service (mismo patrón
// que ya usábamos con /products y /categories -> catalog-service).
export function buildProxyRoutes(config: ConfigService): ProxyRoute[] {
  const authTarget = config.get<string>('AUTH_SERVICE_URL') ?? 'http://localhost:3001';
  const catalogTarget = config.get<string>('CATALOG_SERVICE_URL') ?? 'http://localhost:3002';
  const ordersPaymentsTarget =
    config.get<string>('ORDERS_PAYMENTS_SERVICE_URL') ?? 'http://localhost:3003';

  return [
    { path: '/auth', target: authTarget },
    { path: '/products', target: catalogTarget },
    { path: '/categories', target: catalogTarget },
    { path: '/orders', target: ordersPaymentsTarget },
    { path: '/payments', target: ordersPaymentsTarget },
  ];
}

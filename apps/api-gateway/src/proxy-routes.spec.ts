import { buildProxyRoutes } from './proxy-routes';

function fakeConfig(values: Record<string, string>) {
  return { get: (key: string) => values[key] } as any;
}

describe('buildProxyRoutes', () => {
  it('enruta cada prefijo al servicio correspondiente según las variables de entorno', () => {
    const routes = buildProxyRoutes(
      fakeConfig({
        AUTH_SERVICE_URL: 'http://auth:3001',
        CATALOG_SERVICE_URL: 'http://catalog:3002',
        ORDERS_PAYMENTS_SERVICE_URL: 'http://orders-payments:3003',
      }),
    );

    expect(routes).toEqual([
      { path: '/auth', target: 'http://auth:3001' },
      { path: '/products', target: 'http://catalog:3002' },
      { path: '/categories', target: 'http://catalog:3002' },
      { path: '/orders', target: 'http://orders-payments:3003' },
      { path: '/payments', target: 'http://orders-payments:3003' },
    ]);
  });

  it('usa localhost como fallback cuando falta una variable de entorno', () => {
    const routes = buildProxyRoutes(fakeConfig({}));

    expect(routes.find((r) => r.path === '/auth')?.target).toBe('http://localhost:3001');
    expect(routes.find((r) => r.path === '/products')?.target).toBe('http://localhost:3002');
    expect(routes.find((r) => r.path === '/orders')?.target).toBe('http://localhost:3003');
  });

  it('/products y /categories comparten siempre el mismo destino (catalog-service)', () => {
    const routes = buildProxyRoutes(fakeConfig({ CATALOG_SERVICE_URL: 'http://catalog:9999' }));

    const products = routes.find((r) => r.path === '/products');
    const categories = routes.find((r) => r.path === '/categories');
    expect(products?.target).toBe(categories?.target);
  });

  it('/orders y /payments comparten siempre el mismo destino (orders-payments-service, desde la fusión v2.0)', () => {
    const routes = buildProxyRoutes(
      fakeConfig({ ORDERS_PAYMENTS_SERVICE_URL: 'http://orders-payments:9999' }),
    );

    const orders = routes.find((r) => r.path === '/orders');
    const payments = routes.find((r) => r.path === '/payments');
    expect(orders?.target).toBe(payments?.target);
  });
});

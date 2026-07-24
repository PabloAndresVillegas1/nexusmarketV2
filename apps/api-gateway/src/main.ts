// Debe ser el primer import del archivo.
import './instrument';

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { AppModule } from './app.module';
import { buildProxyRoutes } from './proxy-routes';

async function bootstrap() {
  // bodyParser: false es CLAVE: si Nest parseara el JSON del body aquí,
  // el proxy ya no tendría el stream crudo original para reenviarlo.
  // Eso rompería, por ejemplo, la firma HMAC del webhook de Stripe que
  // viaja a través del gateway hacia orders-payments-service. El gateway no debe
  // tocar el body — solo enrutar bytes.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(ConfigService);

  app.use(helmet());

  const corsOrigin = config.get<string>('CORS_ORIGIN') ?? '*';
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  });

  // Rate limiting global: protege a TODOS los servicios de detrás sin que
  // cada uno tenga que implementar el suyo. Se aplica antes del proxy.
  app.use(
    rateLimit({
      windowMs: Number(config.get('RATE_LIMIT_WINDOW_MS') ?? 60_000),
      limit: Number(config.get('RATE_LIMIT_MAX') ?? 100),
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        message: 'Demasiadas peticiones, intenta de nuevo en un momento',
      },
    }),
  );

  const routes = buildProxyRoutes(config);

  for (const route of routes) {
    app.use(
      route.path,
      createProxyMiddleware({
        target: route.target,
        changeOrigin: true,
        // Express recorta el prefijo montado (ej. "/auth") del req.url que
        // le llega al middleware. Lo volvemos a anteponer para que el
        // servicio destino reciba la ruta completa tal como la espera
        // (ej. "/auth/login", no solo "/login").
        pathRewrite: (path) => `${route.path}${path}`,
        logger: console,
      }),
    );
  }

  const port = config.get<string>('PORT') ?? 3000;
  await app.listen(port);
  Logger.log(`🚪 api-gateway escuchando en el puerto ${port}`, 'Bootstrap');
  routes.forEach((r) =>
    Logger.log(`   ${r.path.padEnd(12)} → ${r.target}`, 'Bootstrap'),
  );
}

bootstrap();

// Debe ser el primer import del archivo: así Sentry puede instrumentar
// automáticamente todo lo que se importe después.
import './instrument';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors();

  const port = process.env.PORT ?? 3002;
  await app.listen(port);
  Logger.log(`🛍️  catalog-service escuchando en el puerto ${port}`, 'Bootstrap');
}

bootstrap();

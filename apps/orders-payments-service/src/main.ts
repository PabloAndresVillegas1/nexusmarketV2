// Debe ser el primer import del archivo.
import './instrument';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true hace que Nest guarde el buffer sin parsear en
  // req.rawBody ADEMÁS de parsear el JSON normalmente. Lo necesitamos
  // porque Stripe firma el body crudo exacto del webhook — si lo
  // parseamos y volvemos a serializar, la firma HMAC ya no coincide.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Helmet solo agrega headers de respuesta; no toca el body de la
  // request, así que no interfiere con la captura de rawBody.
  app.use(helmet());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors();

  const port = process.env.PORT ?? 3003;
  await app.listen(port);
  Logger.log(
    `🧾💳 orders-payments-service escuchando en el puerto ${port}`,
    'Bootstrap',
  );
}

bootstrap();

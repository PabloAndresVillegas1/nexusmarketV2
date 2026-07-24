// Debe ser el primer import del archivo: así Sentry puede instrumentar
// automáticamente todo lo que se importe después (Express, Prisma, etc).
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
      whitelist: true, // descarta propiedades no declaradas en los DTOs
      forbidNonWhitelisted: true, // rechaza el request si vienen propiedades extra
      transform: true, // convierte payloads planos a instancias de clase
    }),
  );

  app.enableCors();

  const port = process.env.PORT ?? 3001;
  //await app.listen(port);
  await app.listen(port, '0.0.0.0');              //Ajustado para que escuche en todas las interfaces de red, no solo localhost
  Logger.log(`🔐 auth-service escuchando en el puerto ${port}`, 'Bootstrap');
}

bootstrap();

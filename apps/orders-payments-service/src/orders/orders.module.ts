import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { CatalogClient } from './catalog.client';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, CatalogClient],
  // Antes, PaymentsService llamaba a order-service por HTTP (OrderClient).
  // Ahora que viven en el mismo proceso, PaymentsModule importa este
  // módulo y le inyecta OrdersService directamente.
  exports: [OrdersService],
})
export class OrdersModule {}

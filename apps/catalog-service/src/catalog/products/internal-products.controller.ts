import {
  Body,
  Controller,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InternalAuthGuard } from '../../auth/guards/internal-auth.guard';
import { DecrementStockDto } from './dto/decrement-stock.dto';

@Controller('internal/products')
@UseGuards(InternalAuthGuard)
export class InternalProductsController {
  constructor(private readonly prisma: PrismaService) {}

  // Llamado por orders-payments-service cuando Stripe confirma un pago.
  // No valida "ownership" de vendedor porque quien llama es el sistema,
  // no un usuario — la validación de negocio ya ocurrió en orders-payments-service.
  @Patch(':id/decrement-stock')
  async decrementStock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecrementStockDto,
  ) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    return this.prisma.product.update({
      where: { id },
      data: { stock: { decrement: dto.quantity } },
    });
  }
}

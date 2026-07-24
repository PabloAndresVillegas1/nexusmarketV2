import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogClient } from './catalog.client';
import { CreateOrderDto } from './dto/create-order.dto';

interface AuthUser {
  sub: string;
  role: string;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogClient: CatalogClient,
  ) {}

  async create(buyerId: string, dto: CreateOrderDto) {
    // 1. Validamos cada item contra catalog-service: stock, disponibilidad
    //    y, sobre todo, el PRECIO REAL. Nunca confiamos en un priceCents que
    //    pudiera venir del body del request — eso permitiría a cualquiera
    //    comprar un producto de $100 pagando $1 con un request manipulado.
    const itemsWithPrice = await Promise.all(
      dto.items.map(async (item) => {
        const product = await this.catalogClient.getProduct(item.productId);

        if (!product.isActive) {
          throw new BadRequestException(
            `"${product.title}" ya no está disponible`,
          );
        }
        if (product.stock < item.quantity) {
          throw new BadRequestException(
            `Stock insuficiente para "${product.title}" (disponible: ${product.stock})`,
          );
        }

        return {
          productId: item.productId,
          quantity: item.quantity,
          unitPriceCents: product.priceCents,
        };
      }),
    );

    const totalCents = itemsWithPrice.reduce(
      (sum, item) => sum + item.unitPriceCents * item.quantity,
      0,
    );

    return this.prisma.order.create({
      data: {
        buyerId,
        status: 'pending',
        totalCents,
        items: { create: itemsWithPrice },
      },
      include: { items: true },
    });
  }

  async findAllForUser(user: AuthUser) {
    const where = user.role === 'admin' ? {} : { buyerId: user.sub };
    return this.prisma.order.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: AuthUser) {
    const order = await this.findOneRaw(id);
    if (order.buyerId !== user.sub && user.role !== 'admin') {
      throw new ForbiddenException('No tienes acceso a este pedido');
    }
    return order;
  }

  // Sin chequeo de ownership: la usa PaymentsService, que ya hizo su
  // propio chequeo de ownership contra el usuario autenticado que inició
  // el checkout. Antes esto era exactamente lo que exponía el endpoint
  // interno GET /internal/orders/:id vía HTTP — ahora es una llamada de
  // método directa, dentro del mismo proceso.
  async findOneRaw(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }
    return order;
  }

  // Antes era el PATCH /internal/orders/:id/mark-paid que payment-service
  // llamaba por HTTP con el INTERNAL_API_KEY. Ahora, mismo proceso, mismo
  // resultado, sin red de por medio.
  async markPaid(id: string) {
    await this.findOneRaw(id); // valida que exista, lanza 404 si no
    return this.prisma.order.update({
      where: { id },
      data: { status: 'paid' },
    });
  }

  async cancel(id: string, user: AuthUser) {
    const order = await this.findOne(id, user);

    if (order.status !== 'pending') {
      throw new BadRequestException(
        `No se puede cancelar un pedido en estado "${order.status}"`,
      );
    }

    return this.prisma.order.update({
      where: { id },
      data: { status: 'cancelled' },
    });
  }
}

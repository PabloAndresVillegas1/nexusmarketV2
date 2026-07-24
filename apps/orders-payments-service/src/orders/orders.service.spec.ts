import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogClient } from './catalog.client';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: {
    order: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  };
  let catalogClient: { getProduct: jest.Mock };

  beforeEach(async () => {
    prisma = {
      order: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    catalogClient = { getProduct: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: CatalogClient, useValue: catalogClient },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  describe('create', () => {
    it('usa SIEMPRE el precio de catalog-service, sin importar qué venga en el DTO', async () => {
      catalogClient.getProduct.mockResolvedValue({
        id: 'p1',
        title: 'Camiseta',
        priceCents: 5000, // precio real y autoritativo
        stock: 10,
        isActive: true,
      });
      prisma.order.create.mockResolvedValue({ id: 'order-1', items: [] });

      // El DTO real (CreateOrderDto) ni siquiera acepta un campo de precio,
      // pero esta prueba documenta la garantía: el total se calcula 100%
      // server-side a partir de lo que devuelve catalog-service.
      await service.create('buyer-1', {
        items: [{ productId: 'p1', quantity: 2 }],
      } as any);

      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ totalCents: 10000 }), // 5000 * 2
        }),
      );
    });

    it('rechaza el pedido si no hay stock suficiente', async () => {
      catalogClient.getProduct.mockResolvedValue({
        id: 'p1',
        title: 'Camiseta',
        priceCents: 5000,
        stock: 1,
        isActive: true,
      });

      await expect(
        service.create('buyer-1', { items: [{ productId: 'p1', quantity: 5 }] } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza el pedido si el producto ya no está activo', async () => {
      catalogClient.getProduct.mockResolvedValue({
        id: 'p1',
        title: 'Camiseta',
        priceCents: 5000,
        stock: 10,
        isActive: false,
      });

      await expect(
        service.create('buyer-1', { items: [{ productId: 'p1', quantity: 1 }] } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('congela el precio unitario de cada item en el momento de la compra', async () => {
      catalogClient.getProduct.mockResolvedValue({
        id: 'p1',
        title: 'Camiseta',
        priceCents: 3000,
        stock: 10,
        isActive: true,
      });
      prisma.order.create.mockResolvedValue({ id: 'order-1' });

      await service.create('buyer-1', {
        items: [{ productId: 'p1', quantity: 3 }],
      } as any);

      const items = prisma.order.create.mock.calls[0][0].data.items.create;
      expect(items[0]).toEqual(
        expect.objectContaining({ productId: 'p1', quantity: 3, unitPriceCents: 3000 }),
      );
    });
  });

  describe('cancel', () => {
    it('permite cancelar un pedido pendiente', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        buyerId: 'buyer-1',
        status: 'pending',
      });
      prisma.order.update.mockResolvedValue({ id: 'o1', status: 'cancelled' });

      const result = await service.cancel('o1', { sub: 'buyer-1', role: 'buyer' });
      expect(result.status).toBe('cancelled');
    });

    it('bloquea cancelar un pedido que ya está pagado', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        buyerId: 'buyer-1',
        status: 'paid',
      });

      await expect(
        service.cancel('o1', { sub: 'buyer-1', role: 'buyer' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('bloquea a un comprador que intenta cancelar el pedido de OTRO comprador', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        buyerId: 'buyer-1',
        status: 'pending',
      });

      await expect(
        service.cancel('o1', { sub: 'buyer-2', role: 'buyer' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});

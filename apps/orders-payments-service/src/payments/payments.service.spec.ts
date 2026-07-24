import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';
import { OrdersService } from '../orders/orders.service';
import { CatalogClient } from './catalog.client';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: {
    payment: { upsert: jest.Mock; update: jest.Mock; updateMany: jest.Mock; findUnique: jest.Mock };
  };
  let stripeService: { createCheckoutSession: jest.Mock };
  let ordersService: { findOneRaw: jest.Mock; markPaid: jest.Mock };
  let catalogClient: { decrementStock: jest.Mock };

  beforeEach(async () => {
    prisma = {
      payment: {
        upsert: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    stripeService = { createCheckoutSession: jest.fn() };
    ordersService = { findOneRaw: jest.fn(), markPaid: jest.fn() };
    catalogClient = { decrementStock: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StripeService, useValue: stripeService },
        { provide: OrdersService, useValue: ordersService },
        { provide: CatalogClient, useValue: catalogClient },
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  describe('createCheckoutSession', () => {
    it('bloquea a un comprador que intenta pagar el pedido de OTRO comprador', async () => {
      ordersService.findOneRaw.mockResolvedValue({
        id: 'o1',
        buyerId: 'buyer-1',
        status: 'pending',
        totalCents: 5000,
        currency: 'USD',
        items: [],
      });

      await expect(
        service.createCheckoutSession({ sub: 'buyer-2', role: 'buyer' }, 'o1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rechaza pagar un pedido que no está pending', async () => {
      ordersService.findOneRaw.mockResolvedValue({
        id: 'o1',
        buyerId: 'buyer-1',
        status: 'paid',
        totalCents: 5000,
        currency: 'USD',
        items: [],
      });

      await expect(
        service.createCheckoutSession({ sub: 'buyer-1', role: 'buyer' }, 'o1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('crea la sesión de Stripe y guarda el pago como pending', async () => {
      ordersService.findOneRaw.mockResolvedValue({
        id: 'o1',
        buyerId: 'buyer-1',
        status: 'pending',
        totalCents: 5000,
        currency: 'USD',
        items: [],
      });
      stripeService.createCheckoutSession.mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/cs_test_123',
      });
      prisma.payment.upsert.mockResolvedValue({});

      const result = await service.createCheckoutSession(
        { sub: 'buyer-1', role: 'buyer' },
        'o1',
      );

      expect(result.checkoutUrl).toBe('https://checkout.stripe.com/cs_test_123');
      expect(prisma.payment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ status: 'pending', stripeSessionId: 'cs_test_123' }),
        }),
      );
    });

    it('nunca filtra el error crudo de Stripe: lo traduce a un mensaje seguro', async () => {
      ordersService.findOneRaw.mockResolvedValue({
        id: 'o1',
        buyerId: 'buyer-1',
        status: 'pending',
        totalCents: 5000,
        currency: 'USD',
        items: [],
      });
      stripeService.createCheckoutSession.mockRejectedValue(
        new Error('Invalid API Key provided: sk_test_...'),
      );

      await expect(
        service.createCheckoutSession({ sub: 'buyer-1', role: 'buyer' }, 'o1'),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('handleStripeEvent', () => {
    it('en checkout.session.completed: marca el pago, el pedido como pagado (llamada directa) y descuenta stock', async () => {
      prisma.payment.update.mockResolvedValue({});
      ordersService.markPaid.mockResolvedValue(undefined);
      ordersService.findOneRaw.mockResolvedValue({
        id: 'o1',
        items: [{ productId: 'p1', quantity: 2, unitPriceCents: 5000 }],
      });
      catalogClient.decrementStock.mockResolvedValue(undefined);

      await service.handleStripeEvent({
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_123', metadata: { orderId: 'o1' } } },
      } as any);

      // Ya no es una llamada HTTP (OrderClient.markPaid) — es un método
      // directo de OrdersService, inyectado en el mismo módulo.
      expect(ordersService.markPaid).toHaveBeenCalledWith('o1');
      expect(catalogClient.decrementStock).toHaveBeenCalledWith('p1', 2);
    });

    it('ignora eventos de Stripe que no le interesan', async () => {
      await service.handleStripeEvent({ type: 'charge.refunded', data: { object: {} } } as any);

      expect(ordersService.markPaid).not.toHaveBeenCalled();
      expect(catalogClient.decrementStock).not.toHaveBeenCalled();
    });
  });
});

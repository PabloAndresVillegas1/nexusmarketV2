import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';
import { CatalogClient } from './catalog.client';
import { OrdersService } from '../orders/orders.service';

interface AuthUser {
  sub: string;
  role: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    // Antes era OrderClient (HTTP hacia order-service). Ahora que ambos
    // viven en el mismo proceso, inyectamos OrdersService directamente:
    // una llamada de método normal, sin red, sin INTERNAL_API_KEY, sin
    // posibilidad de que "el otro servicio esté caído".
    private readonly ordersService: OrdersService,
    private readonly catalogClient: CatalogClient,
  ) {}

  async createCheckoutSession(user: AuthUser, orderId: string) {
    const order = await this.ordersService.findOneRaw(orderId);

    if (order.buyerId !== user.sub && user.role !== 'admin') {
      throw new ForbiddenException('No puedes pagar un pedido que no es tuyo');
    }
    if (order.status !== 'pending') {
      throw new BadRequestException(
        `Este pedido está en estado "${order.status}", no se puede pagar`,
      );
    }

    let session: Stripe.Checkout.Session;
    try {
      session = await this.stripeService.createCheckoutSession(
        order.id,
        order.currency,
        order.items,
      );
    } catch (err) {
      // Nunca devolvemos el error crudo de Stripe al cliente (podría
      // filtrar detalles de configuración, como que la API key es
      // inválida). Lo logueamos completo del lado del servidor para
      // poder diagnosticarlo, y devolvemos un mensaje seguro y genérico.
      this.logger.error(
        'Error creando la sesión de checkout en Stripe',
        err instanceof Error ? err.stack : String(err),
      );
      throw new ServiceUnavailableException(
        'No se pudo iniciar el pago en este momento. Intenta de nuevo en unos minutos.',
      );
    }

    // upsert: si el comprador reintenta el checkout de un mismo pedido
    // (ej. cerró la pestaña de Stripe), reemplazamos la sesión anterior
    // en vez de acumular filas de pagos "pending" huérfanas.
    await this.prisma.payment.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        buyerId: order.buyerId,
        stripeSessionId: session.id,
        amountCents: order.totalCents,
        currency: order.currency,
        status: 'pending',
      },
      update: {
        stripeSessionId: session.id,
        status: 'pending',
      },
    });

    return { checkoutUrl: session.url };
  }

  async getPaymentStatus(orderId: string, user: AuthUser) {
    const payment = await this.prisma.payment.findUnique({ where: { orderId } });
    if (!payment) {
      throw new NotFoundException('No hay pago registrado para este pedido');
    }
    if (payment.buyerId !== user.sub && user.role !== 'admin') {
      throw new ForbiddenException('No tienes acceso a este pago');
    }
    return payment;
  }

  async handleStripeEvent(event: Stripe.Event) {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case 'checkout.session.expired':
        await this.onCheckoutExpired(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      default:
        // Ignoramos silenciosamente eventos que no nos interesan — Stripe
        // envía docenas de tipos de evento distintos.
        this.logger.debug(`Evento ignorado: ${event.type}`);
    }
    return { received: true };
  }

  private async onCheckoutCompleted(session: Stripe.Checkout.Session) {
    const orderId = session.metadata?.orderId;
    if (!orderId) {
      this.logger.warn(`Sesión ${session.id} sin orderId en metadata`);
      return;
    }

    const payment = await this.prisma.payment.update({
      where: { stripeSessionId: session.id },
      data: { status: 'succeeded' },
    });

    // 1. Marcamos el pedido como pagado — llamada directa, no HTTP.
    await this.ordersService.markPaid(orderId);

    // 2. Descontamos stock en catalog-service (ese sí sigue siendo un
    //    servicio externo real, así que esta llamada SÍ es HTTP).
    const order = await this.ordersService.findOneRaw(orderId);
    await Promise.all(
      order.items.map((item: { productId: string; quantity: number }) =>
        this.catalogClient.decrementStock(item.productId, item.quantity),
      ),
    );

    this.logger.log(`Pago confirmado para el pedido ${orderId}`);
    return payment;
  }

  private async onCheckoutExpired(session: Stripe.Checkout.Session) {
    await this.prisma.payment.updateMany({
      where: { stripeSessionId: session.id },
      data: { status: 'failed' },
    });
  }
}

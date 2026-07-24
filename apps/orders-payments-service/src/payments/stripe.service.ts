import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

interface OrderItemForCheckout {
  productId: string;
  quantity: number;
  unitPriceCents: number;
}

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;
  private readonly successUrl: string;
  private readonly cancelUrl: string;

  constructor(private readonly config: ConfigService) {
    this.stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY')!, {
      apiVersion: '2025-02-24.acacia',
    });
    this.webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET')!;
    this.successUrl =
      this.config.get<string>('CHECKOUT_SUCCESS_URL') ??
      'http://localhost:3006/checkout/success';
    this.cancelUrl =
      this.config.get<string>('CHECKOUT_CANCEL_URL') ??
      'http://localhost:3006/checkout/cancel';
  }

  async createCheckoutSession(
    orderId: string,
    currency: string,
    items: OrderItemForCheckout[],
  ): Promise<Stripe.Checkout.Session> {
    return this.stripe.checkout.sessions.create({
      mode: 'payment',
      currency: currency.toLowerCase(),
      line_items: items.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: currency.toLowerCase(),
          unit_amount: item.unitPriceCents,
          product_data: { name: `Producto ${item.productId}` },
        },
      })),
      // El orderId viaja en metadata: es lo que nos permite, en el webhook,
      // saber a qué pedido de order-service corresponde este pago de Stripe.
      metadata: { orderId },
      success_url: `${this.successUrl}?orderId=${orderId}`,
      cancel_url: `${this.cancelUrl}?orderId=${orderId}`,
    });
  }

  // Verifica que el webhook realmente venga de Stripe (firma HMAC), no de
  // un tercero haciendo POST directo a nuestro endpoint para marcar pedidos
  // como pagados gratis.
  constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.webhookSecret,
    );
  }
}

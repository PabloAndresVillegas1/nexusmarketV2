import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CatalogClient {
  private readonly baseUrl: string;
  private readonly internalKey: string;
  private readonly logger = new Logger(CatalogClient.name);

  constructor(config: ConfigService) {
    this.baseUrl =
      config.get<string>('CATALOG_SERVICE_URL') ?? 'http://localhost:3002';
    this.internalKey = config.get<string>('INTERNAL_API_KEY')!;
  }

  async decrementStock(productId: string, quantity: number): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/internal/products/${productId}/decrement-stock`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': this.internalKey,
        },
        body: JSON.stringify({ quantity }),
      },
    );

    // Si esto falla, NO revertimos el pago (ya se cobró). Solo lo logueamos
    // para que un proceso de reconciliación o una alerta lo detecte —
    // es preferible tener stock desincronizado momentáneamente a devolver
    // dinero automáticamente sin supervisión humana.
    if (!response.ok) {
      this.logger.error(
        `No se pudo descontar stock de ${productId} (qty: ${quantity}). Requiere reconciliación manual.`,
      );
    }
  }
}

import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface CatalogProduct {
  id: string;
  title: string;
  priceCents: number;
  stock: number;
  isActive: boolean;
}

// Encapsula TODA la comunicación con catalog-service en un solo lugar.
// Si mañana cambiamos de llamada HTTP directa a un cliente gRPC o a
// eventos por cola, solo tocamos este archivo — order.service.ts no
// se entera del transporte que se use por debajo.
@Injectable()
export class CatalogClient {
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl =
      config.get<string>('CATALOG_SERVICE_URL') ?? 'http://localhost:3002';
  }

  async getProduct(productId: string): Promise<CatalogProduct> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/products/${productId}`);
    } catch {
      // El catalog-service no responde: fallamos rápido y claro en vez de
      // dejar que el error de red se propague como un 500 genérico.
      throw new ServiceUnavailableException(
        'No se pudo conectar con el servicio de catálogo',
      );
    }

    if (response.status === 404) {
      throw new BadRequestException(`Producto ${productId} no existe`);
    }
    if (!response.ok) {
      throw new ServiceUnavailableException('Error consultando el catálogo');
    }

    return response.json();
  }
}

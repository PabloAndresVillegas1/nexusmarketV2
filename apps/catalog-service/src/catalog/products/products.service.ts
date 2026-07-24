import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';

interface AuthUser {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(sellerId: string, dto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        ...dto,
        currency: dto.currency ?? 'USD',
        sellerId,
      },
    });
  }

  async findAll(query: QueryProductsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where = {
      isActive: true,
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.search && {
        title: { contains: query.search, mode: 'insensitive' as const },
      }),
      ...(query.minPriceCents !== undefined || query.maxPriceCents !== undefined
        ? {
            priceCents: {
              ...(query.minPriceCents !== undefined && { gte: query.minPriceCents }),
              ...(query.maxPriceCents !== undefined && { lte: query.maxPriceCents }),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { category: true },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }
    return product;
  }

  async update(id: string, user: AuthUser, dto: UpdateProductDto) {
    const product = await this.findOne(id);
    this.assertOwnership(product.sellerId, user);

    return this.prisma.product.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, user: AuthUser) {
    const product = await this.findOne(id);
    this.assertOwnership(product.sellerId, user);

    // Soft delete: preferible a borrar filas para no romper pedidos
    // históricos que referencian este producto en orders-payments-service.
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private assertOwnership(sellerId: string, user: AuthUser) {
    const isOwner = sellerId === user.sub;
    const isAdmin = user.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('No tienes permiso sobre este producto');
    }
  }
}

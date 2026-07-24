import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: {
    product: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      product: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ProductsService);
  });

  describe('create', () => {
    it('asigna el sellerId del usuario autenticado (nunca algo que venga del body)', async () => {
      prisma.product.create.mockResolvedValue({ id: 'p1' });

      await service.create('seller-1', {
        title: 'Camiseta',
        description: 'Una camiseta de prueba bien descrita',
        priceCents: 1999,
        stock: 5,
      } as any);

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sellerId: 'seller-1' }),
        }),
      );
    });
  });

  describe('update', () => {
    it('permite al dueño editar su propio producto', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'p1', sellerId: 'seller-1' });
      prisma.product.update.mockResolvedValue({ id: 'p1', title: 'Nuevo título' });

      const result = await service.update(
        'p1',
        { sub: 'seller-1', email: 'x', role: 'seller' } as any,
        { title: 'Nuevo título' } as any,
      );

      expect(result.title).toBe('Nuevo título');
    });

    it('bloquea a un vendedor que intenta editar el producto de OTRO vendedor', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'p1', sellerId: 'seller-1' });

      await expect(
        service.update(
          'p1',
          { sub: 'seller-2', email: 'x', role: 'seller' } as any,
          { title: 'Hackeado' } as any,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it('permite a un admin editar cualquier producto', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'p1', sellerId: 'seller-1' });
      prisma.product.update.mockResolvedValue({ id: 'p1' });

      await expect(
        service.update('p1', { sub: 'admin-1', email: 'x', role: 'admin' } as any, {} as any),
      ).resolves.toBeDefined();
    });

    it('lanza NotFoundException si el producto no existe', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.update(
          'no-existe',
          { sub: 'seller-1', email: 'x', role: 'seller' } as any,
          {} as any,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('hace soft delete (isActive: false), no borra la fila', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'p1', sellerId: 'seller-1' });
      prisma.product.update.mockResolvedValue({ id: 'p1', isActive: false });

      await service.remove('p1', { sub: 'seller-1', email: 'x', role: 'seller' } as any);

      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
    });

    it('bloquea a un vendedor que intenta borrar el producto de otro', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'p1', sellerId: 'seller-1' });

      await expect(
        service.remove('p1', { sub: 'seller-2', email: 'x', role: 'seller' } as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});

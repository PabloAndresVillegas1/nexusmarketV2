import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock };
    refreshToken: {
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let jwt: { sign: jest.Mock; verify: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn() },
      refreshToken: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    jwt = {
      sign: jest.fn().mockReturnValue('signed.jwt.token'),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              ({
                JWT_SECRET: 'test-secret',
                JWT_REFRESH_SECRET: 'test-refresh-secret',
                JWT_EXPIRES_IN: '15m',
              })[key],
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    it('crea un usuario nuevo (rol buyer por defecto) y devuelve tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'ana@test.com',
        role: 'buyer',
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register({
        email: 'ana@test.com',
        password: 'password123',
        name: 'Ana',
      } as any);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'ana@test.com', role: 'buyer' }),
        }),
      );
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user.email).toBe('ana@test.com');
    });

    it('nunca guarda la contraseña en texto plano', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'u1', email: 'ana@test.com', role: 'buyer' });
      prisma.refreshToken.create.mockResolvedValue({});

      await service.register({
        email: 'ana@test.com',
        password: 'password123',
        name: 'Ana',
      } as any);

      const savedData = prisma.user.create.mock.calls[0][0].data;
      expect(savedData.passwordHash).not.toBe('password123');
      expect(await bcrypt.compare('password123', savedData.passwordHash)).toBe(true);
    });

    it('rechaza el registro si el email ya existe', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

      await expect(
        service.register({ email: 'ana@test.com', password: 'x', name: 'Ana' } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('rechaza si el usuario no existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login({ email: 'nadie@test.com', password: 'x' } as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rechaza si la contraseña no coincide', async () => {
      const hash = await bcrypt.hash('correcta', 12);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'ana@test.com',
        passwordHash: hash,
        role: 'buyer',
      });

      await expect(
        service.login({ email: 'ana@test.com', password: 'incorrecta' } as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('acepta credenciales correctas y devuelve tokens', async () => {
      const hash = await bcrypt.hash('correcta', 12);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'ana@test.com',
        passwordHash: hash,
        role: 'buyer',
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({
        email: 'ana@test.com',
        password: 'correcta',
      } as any);

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user.email).toBe('ana@test.com');
    });
  });

  describe('refresh', () => {
    it('rechaza un refresh token con firma inválida', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      await expect(service.refresh('token-invalido')).rejects.toThrow(UnauthorizedException);
    });

    it('rechaza un refresh token que no está registrado (ya usado o revocado)', async () => {
      jwt.verify.mockReturnValue({ sub: 'user-1', email: 'ana@test.com', role: 'buyer' });
      prisma.refreshToken.findFirst.mockResolvedValue(null);

      await expect(service.refresh('token-revocado')).rejects.toThrow(UnauthorizedException);
    });

    it('rechaza un refresh token vencido', async () => {
      jwt.verify.mockReturnValue({ sub: 'user-1', email: 'ana@test.com', role: 'buyer' });
      prisma.refreshToken.findFirst.mockResolvedValue({
        id: 'rt-1',
        expiresAt: new Date(Date.now() - 1000), // ya venció
      });

      await expect(service.refresh('token-vencido')).rejects.toThrow(UnauthorizedException);
    });

    it('rota el token: revoca el usado y emite uno nuevo', async () => {
      jwt.verify.mockReturnValue({ sub: 'user-1', email: 'ana@test.com', role: 'buyer' });
      prisma.refreshToken.findFirst.mockResolvedValue({
        id: 'rt-1',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      await service.refresh('token-valido');

      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'rt-1' }, data: { revoked: true } }),
      );
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });
  });
});

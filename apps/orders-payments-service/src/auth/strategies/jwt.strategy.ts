import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

// IMPORTANTE: este servicio NUNCA llama por HTTP al auth-service para
// validar una sesión. Como ambos comparten el mismo JWT_SECRET, cada
// servicio puede verificar la firma del token de forma local (stateless).
// Esto es lo que hace que los microservicios escalen: no hay un cuello de
// botella ni un punto único de falla en cada request autenticado.
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: JwtPayload) {
    return { sub: payload.sub, email: payload.email, role: payload.role };
  }
}

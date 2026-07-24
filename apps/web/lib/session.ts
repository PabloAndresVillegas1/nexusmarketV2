import { cookies } from 'next/headers';
import type { SessionUser } from './types';

const ACCESS_COOKIE = 'nexus_access_token';
const REFRESH_COOKIE = 'nexus_refresh_token';

// El access token dura 15 minutos en el backend (ver JWT_EXPIRES_IN en
// auth-service). No implementamos refresco automático todavía — cuando
// expire, el usuario simplemente vuelve a loguearse. Un middleware que
// detecte el token vencido y llame a /auth/refresh transparentemente es
// la mejora natural de este punto (queda anotado como siguiente paso).
const ACCESS_MAX_AGE = 60 * 15;
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export async function setAuthCookies(accessToken: string, refreshToken: string) {
  const store = await cookies();
  store.set(ACCESS_COOKIE, accessToken, { ...cookieOptions, maxAge: ACCESS_MAX_AGE });
  store.set(REFRESH_COOKIE, refreshToken, { ...cookieOptions, maxAge: REFRESH_MAX_AGE });
}

export async function clearAuthCookies() {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

export async function getAccessToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value ?? null;
}

export async function getRefreshToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value ?? null;
}

// Decodifica el payload del JWT SOLO para mostrar datos en la UI
// (nombre, rol, etc). Esto NO es una verificación de firma — la firma ya
// fue verificada por los microservicios cuando emitieron/validaron el
// token. El frontend nunca debe tomar decisiones de seguridad basado en
// un token que no puede verificar criptográficamente por sí mismo.
function decodeAccessToken(token: string): SessionUser | null {
  try {
    const payloadB64 = token.split('.')[1];
    const json = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    const payload = JSON.parse(json);
    return { sub: payload.sub, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const token = await getAccessToken();
  if (!token) return null;
  return decodeAccessToken(token);
}

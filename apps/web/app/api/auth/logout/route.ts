import { NextResponse } from 'next/server';
import { gatewayFetch } from '@/lib/api';
import { getAccessToken, getRefreshToken, clearAuthCookies } from '@/lib/session';

export async function POST() {
  const accessToken = await getAccessToken();
  const refreshToken = await getRefreshToken();

  // Intentamos revocar el refresh token en el backend, pero si falla
  // (backend caído, token ya vencido) igual limpiamos las cookies locales
  // — la sesión del usuario en ESTE navegador debe terminar sí o sí.
  if (accessToken && refreshToken) {
    try {
      await gatewayFetch('/auth/logout', {
        method: 'POST',
        auth: true,
        body: { refreshToken },
      });
    } catch {
      // ignorado a propósito
    }
  }

  await clearAuthCookies();
  return NextResponse.json({ success: true });
}

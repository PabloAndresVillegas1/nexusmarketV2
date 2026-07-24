import { getAccessToken } from './session';

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface GatewayFetchOptions extends Omit<RequestInit, 'body'> {
  auth?: boolean; // si true, adjunta el JWT de la cookie como Bearer token
  body?: unknown; // se serializa a JSON automáticamente
}

// Punto único por el que TODO el frontend habla con el backend. Server
// Components y Route Handlers lo usan directamente; los Client Components
// nunca lo importan — pasan siempre por un Route Handler (ver app/api/*).
export async function gatewayFetch<T>(
  path: string,
  options: GatewayFetchOptions = {},
): Promise<T> {
  const { auth, body, headers: rawHeaders, ...rest } = options;
  const headers = new Headers(rawHeaders);

  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  if (auth) {
    const token = await getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${GATEWAY_URL}${path}`, {
    ...rest,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    // Un marketplace cambia todo el tiempo (stock, precios, pedidos): no
    // queremos que el cache de fetch de Next nos muestre datos viejos.
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      errorBody.message ?? `Error ${response.status} consultando la API`,
    );
  }

  // Algunos endpoints (ej. logout) responden 200 sin body
  const text = await response.text();
  return text ? JSON.parse(text) : (undefined as T);
}

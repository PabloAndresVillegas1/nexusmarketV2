import { NextRequest, NextResponse } from 'next/server';
import { gatewayFetch, ApiError } from '@/lib/api';
import { setAuthCookies } from '@/lib/session';

interface RegisterResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; role: string };
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  try {
    const data = await gatewayFetch<RegisterResponse>('/auth/register', {
      method: 'POST',
      body,
    });

    await setAuthCookies(data.accessToken, data.refreshToken);
    return NextResponse.json({ user: data.user });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    return NextResponse.json({ message: 'Error inesperado' }, { status: 500 });
  }
}

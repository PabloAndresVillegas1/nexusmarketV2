import { NextRequest, NextResponse } from 'next/server';
import { gatewayFetch, ApiError } from '@/lib/api';

export async function POST(request: NextRequest) {
  const body = await request.json();

  try {
    const session = await gatewayFetch<{ checkoutUrl: string }>(
      '/payments/checkout-session',
      { method: 'POST', auth: true, body },
    );
    return NextResponse.json(session);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    return NextResponse.json({ message: 'Error inesperado' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { gatewayFetch, ApiError } from '@/lib/api';

export async function POST(request: NextRequest) {
  const body = await request.json();

  try {
    const order = await gatewayFetch('/orders', {
      method: 'POST',
      auth: true,
      body,
    });
    return NextResponse.json(order, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    return NextResponse.json({ message: 'Error inesperado' }, { status: 500 });
  }
}

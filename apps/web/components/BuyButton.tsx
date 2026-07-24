'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function BuyButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy() {
    setLoading(true);
    setError(null);

    try {
      // 1. Creamos el pedido (order-service valida stock y precio real)
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ productId, quantity: 1 }] }),
      });

      if (orderRes.status === 401) {
        router.push('/login');
        return;
      }
      if (!orderRes.ok) {
        const body = await orderRes.json();
        throw new Error(body.message ?? 'No se pudo crear el pedido');
      }
      const order = await orderRes.json();

      // 2. Iniciamos el checkout de Stripe para ese pedido
      const checkoutRes = await fetch('/api/payments/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      });
      if (checkoutRes.status === 401) {
        setError('Tu sesión expiró. Inicia sesión de nuevo para continuar.');
        setLoading(false);
        return;
      }
      if (!checkoutRes.ok) {
        const body = await checkoutRes.json();
        throw new Error(body.message ?? 'No se pudo iniciar el pago');
      }
      const { checkoutUrl } = await checkoutRes.json();

      // 3. Redirigimos al Checkout hospedado por Stripe
      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={handleBuy} disabled={loading} className="btn-primary w-full">
        {loading ? 'Procesando...' : 'Comprar ahora'}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

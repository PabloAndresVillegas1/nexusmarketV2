'use client';

import { useState } from 'react';

export function PayButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/payments/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      if (res.status === 401) {
        setError('Tu sesión expiró. Inicia sesión de nuevo para continuar.');
        setLoading(false);
        return;
      }
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message ?? 'No se pudo iniciar el pago');
      }
      const { checkoutUrl } = await res.json();
      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={handlePay} disabled={loading} className="btn-primary w-full">
        {loading ? 'Redirigiendo a Stripe...' : 'Pagar ahora'}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

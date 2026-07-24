import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { gatewayFetch, ApiError } from '@/lib/api';
import { formatMoney, formatDate } from '@/lib/format';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { PayButton } from '@/components/PayButton';
import type { Order } from '@/lib/types';

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  let order: Order;
  try {
    order = await gatewayFetch<Order>(`/orders/${id}`, { auth: true });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
      notFound();
    }
    throw err;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Pedido #{order.id.slice(0, 8)}
        </h1>
        <OrderStatusBadge status={order.status} />
      </div>
      <p className="mt-1 text-sm text-gray-500">Creado el {formatDate(order.createdAt)}</p>

      <div className="card mt-6 divide-y divide-gray-100">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
            <div>
              <p className="text-sm text-gray-900">Producto {item.productId.slice(0, 8)}</p>
              <p className="text-xs text-gray-500">Cantidad: {item.quantity}</p>
            </div>
            <span className="font-medium text-gray-900">
              {formatMoney(item.unitPriceCents * item.quantity, order.currency)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between text-lg font-bold text-gray-900">
        <span>Total</span>
        <span>{formatMoney(order.totalCents, order.currency)}</span>
      </div>

      {order.status === 'pending' && (
        <div className="mt-6 max-w-xs">
          <PayButton orderId={order.id} />
        </div>
      )}
    </div>
  );
}

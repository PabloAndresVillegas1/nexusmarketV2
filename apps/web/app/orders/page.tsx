import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { gatewayFetch } from '@/lib/api';
import { formatMoney, formatDate } from '@/lib/format';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import type { Order } from '@/lib/types';

export default async function OrdersPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const orders = await gatewayFetch<Order[]>('/orders', { auth: true });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Mis pedidos</h1>

      {orders.length === 0 ? (
        <p className="mt-6 text-gray-500">
          Todavía no tienes pedidos.{' '}
          <Link href="/" className="text-brand-600 underline">
            Explora el catálogo
          </Link>
          .
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="card flex items-center justify-between hover:shadow-md transition"
            >
              <div>
                <p className="font-medium text-gray-900">
                  Pedido #{order.id.slice(0, 8)}
                </p>
                <p className="text-sm text-gray-500">{formatDate(order.createdAt)}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-semibold text-gray-900">
                  {formatMoney(order.totalCents, order.currency)}
                </span>
                <OrderStatusBadge status={order.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import Link from 'next/link';

export default async function CheckoutCancelPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;

  return (
    <div className="mx-auto max-w-md text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 text-2xl">
        !
      </div>
      <h1 className="mt-4 text-xl font-bold text-gray-900">Pago cancelado</h1>
      <p className="mt-2 text-gray-500">
        No se completó el pago. Tu pedido sigue pendiente, puedes intentarlo
        de nuevo cuando quieras.
      </p>
      {orderId && (
        <Link href={`/orders/${orderId}`} className="btn-primary mt-6 inline-flex">
          Volver al pedido
        </Link>
      )}
    </div>
  );
}

import { notFound } from 'next/navigation';
import { gatewayFetch, ApiError } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { BuyButton } from '@/components/BuyButton';
import type { Product } from '@/lib/types';

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let product: Product;
  try {
    product = await gatewayFetch<Product>(`/products/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  return (
    <div className="mx-auto max-w-2xl">
      {product.category && (
        <span className="text-xs font-medium uppercase tracking-wide text-brand-600">
          {product.category.name}
        </span>
      )}
      <h1 className="mt-1 text-2xl font-bold text-gray-900">{product.title}</h1>
      <p className="mt-3 text-gray-600">{product.description}</p>

      <div className="mt-6 flex items-center justify-between">
        <span className="text-3xl font-bold text-gray-900">
          {formatMoney(product.priceCents, product.currency)}
        </span>
        <span className="text-sm text-gray-500">
          {product.stock > 0 ? `${product.stock} disponibles` : 'Sin stock'}
        </span>
      </div>

      <div className="mt-6 max-w-xs">
        {product.stock > 0 ? (
          <BuyButton productId={product.id} />
        ) : (
          <button disabled className="btn-primary w-full">
            Sin stock
          </button>
        )}
      </div>
    </div>
  );
}

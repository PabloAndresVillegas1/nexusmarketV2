import Link from 'next/link';
import type { Product } from '@/lib/types';
import { formatMoney } from '@/lib/format';

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/products/${product.id}`} className="card block hover:shadow-md transition">
      {product.category && (
        <span className="text-xs font-medium uppercase tracking-wide text-brand-600">
          {product.category.name}
        </span>
      )}
      <h3 className="mt-1 font-semibold text-gray-900 line-clamp-1">{product.title}</h3>
      <p className="mt-1 text-sm text-gray-500 line-clamp-2">{product.description}</p>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-lg font-bold text-gray-900">
          {formatMoney(product.priceCents, product.currency)}
        </span>
        <span className="text-xs text-gray-400">
          {product.stock > 0 ? `${product.stock} disponibles` : 'Sin stock'}
        </span>
      </div>
    </Link>
  );
}

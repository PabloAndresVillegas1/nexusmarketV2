import { gatewayFetch } from '@/lib/api';
import { ProductCard } from '@/components/ProductCard';
import type { ProductListResponse } from '@/lib/types';

export default async function HomePage() {
  // Endpoint público: no necesita auth: true. Esto se renderiza en el
  // servidor en cada request (cache: 'no-store' en gatewayFetch), así que
  // el stock/precio que ve el usuario siempre está actualizado.
  const { items } = await gatewayFetch<ProductListResponse>('/products');

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Explora el catálogo</h1>
      <p className="mt-1 text-gray-500">
        {items.length} producto{items.length !== 1 && 's'} disponible
        {items.length !== 1 && 's'}
      </p>

      {items.length === 0 ? (
        <p className="mt-8 text-gray-500">
          Todavía no hay productos publicados.{' '}
          <a href="/register" className="text-brand-600 underline">
            Regístrate como vendedor
          </a>{' '}
          para publicar el primero.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

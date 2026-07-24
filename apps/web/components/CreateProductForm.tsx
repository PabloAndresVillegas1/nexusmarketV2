'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CreateProductForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '', // en la unidad de moneda normal (ej. 19.99), se convierte a centavos al enviar
    stock: '1',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const priceCents = Math.round(parseFloat(form.price) * 100);

    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        description: form.description,
        priceCents,
        stock: parseInt(form.stock, 10),
      }),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.message ?? 'No se pudo crear el producto');
      setLoading(false);
      return;
    }

    const product = await res.json();
    router.push(`/products/${product.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="card mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Publicar un producto</h1>

      <div>
        <label className="block text-sm font-medium text-gray-700">Título</label>
        <input
          required
          minLength={3}
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
          className="input-field mt-1"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Descripción</label>
        <textarea
          required
          minLength={10}
          rows={4}
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          className="input-field mt-1"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Precio (USD)</label>
          <input
            type="number"
            required
            min="0.01"
            step="0.01"
            value={form.price}
            onChange={(e) => update('price', e.target.value)}
            className="input-field mt-1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Stock</label>
          <input
            type="number"
            required
            min="0"
            step="1"
            value={form.stock}
            onChange={(e) => update('stock', e.target.value)}
            className="input-field mt-1"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Publicando...' : 'Publicar producto'}
      </button>
    </form>
  );
}

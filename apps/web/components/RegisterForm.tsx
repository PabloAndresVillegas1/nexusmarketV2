'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export function RegisterForm() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'buyer' as 'buyer' | 'seller',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.message ?? 'No se pudo completar el registro');
      setLoading(false);
      return;
    }

    const { user } = await res.json();
    setUser({ sub: user.id, email: user.email, role: user.role });

    router.push('/');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card mx-auto max-w-sm space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Crea tu cuenta</h1>

      <div>
        <label className="block text-sm font-medium text-gray-700">Nombre</label>
        <input
          required
          minLength={2}
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          className="input-field mt-1"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Email</label>
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
          className="input-field mt-1"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Contraseña</label>
        <input
          type="password"
          required
          minLength={8}
          value={form.password}
          onChange={(e) => update('password', e.target.value)}
          className="input-field mt-1"
        />
        <p className="mt-1 text-xs text-gray-400">Mínimo 8 caracteres</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Quiero...</label>
        <div className="mt-1 flex gap-3">
          {(['buyer', 'seller'] as const).map((role) => (
            <label
              key={role}
              className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-sm ${
                form.role === role
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-gray-300 text-gray-600'
              }`}
            >
              <input
                type="radio"
                name="role"
                value={role}
                checked={form.role === role}
                onChange={() => update('role', role)}
                className="sr-only"
              />
              {role === 'buyer' ? 'Comprar' : 'Vender'}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Creando cuenta...' : 'Registrarme'}
      </button>

      <p className="text-center text-sm text-gray-500">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="text-brand-600 underline">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export function LoginForm() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.message ?? 'No se pudo iniciar sesión');
      setLoading(false);
      return;
    }

    const { user } = await res.json();
    // Actualización instantánea del Navbar (y de cualquier otro consumidor
    // del contexto), sin esperar a que Next vuelva a renderizar el layout.
    setUser({ sub: user.id, email: user.email, role: user.role });

    router.push('/');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card mx-auto max-w-sm space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Inicia sesión</h1>

      <div>
        <label className="block text-sm font-medium text-gray-700">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-field mt-1"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Contraseña</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input-field mt-1"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Ingresando...' : 'Ingresar'}
      </button>

      <p className="text-center text-sm text-gray-500">
        ¿No tienes cuenta?{' '}
        <Link href="/register" className="text-brand-600 underline">
          Regístrate
        </Link>
      </p>
    </form>
  );
}

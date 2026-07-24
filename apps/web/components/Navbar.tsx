'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import type { SessionUser } from '@/lib/types';

const ROLE_LABELS: Record<SessionUser['role'], string> = {
  buyer: 'Comprador',
  seller: 'Vendedor',
  admin: 'Admin',
};

export function Navbar() {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    // Actualización INSTANTÁNEA del Navbar, sin depender del timing de
    // router.refresh(). El refresh se hace igual, como red de seguridad
    // para que el resto de Server Components (ej. páginas protegidas)
    // reflejen la sesión cerrada en la próxima navegación.
    setUser(null);
    setLoggingOut(false);
    router.push('/');
    router.refresh();
  }

  return (
    <header className="border-b border-gray-200 bg-white">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold text-brand-600">
          NexusMarket
        </Link>

        <div className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              {(user.role === 'seller' || user.role === 'admin') && (
                <Link href="/products/new" className="text-gray-600 hover:text-brand-600">
                  Vender
                </Link>
              )}
              <Link href="/orders" className="text-gray-600 hover:text-brand-600">
                Mis pedidos
              </Link>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                {user.email} · {ROLE_LABELS[user.role]}
              </span>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="btn-secondary"
              >
                {loggingOut ? 'Saliendo...' : 'Cerrar sesión'}
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-gray-600 hover:text-brand-600">
                Iniciar sesión
              </Link>
              <Link href="/register" className="btn-primary">
                Registrarse
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

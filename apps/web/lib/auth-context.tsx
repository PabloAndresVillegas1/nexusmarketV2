'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { SessionUser } from './types';

interface AuthContextValue {
  user: SessionUser | null;
  setUser: (user: SessionUser | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser: SessionUser | null;
  children: ReactNode;
}) {
  const [user, setUser] = useState<SessionUser | null>(initialUser);

  // useState(initialUser) solo se usa en el PRIMER render — si layout.tsx
  // (Server Component) vuelve a ejecutarse con una sesión distinta (ej. tras
  // router.refresh() o una navegación completa), este efecto sincroniza el
  // contexto con esa verdad del servidor. Así combinamos lo mejor de los dos
  // mundos: actualización INSTANTÁNEA vía setUser() en login/logout, y
  // reconciliación con el servidor como red de seguridad.
  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);

  return (
    <AuthContext.Provider value={{ user, setUser }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de un <AuthProvider>');
  }
  return ctx;
}

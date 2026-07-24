import type { Metadata } from 'next';
import { getSession } from '@/lib/session';
import { AuthProvider } from '@/lib/auth-context';
import { Navbar } from '@/components/Navbar';
import './globals.css';

export const metadata: Metadata = {
  title: 'NexusMarket',
  description: 'Marketplace multi-vendedor — proyecto base full-stack',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <html lang="es">
      <body>
        <AuthProvider initialUser={session}>
          <Navbar />
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}

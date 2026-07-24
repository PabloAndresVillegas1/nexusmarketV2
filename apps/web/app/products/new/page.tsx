import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { CreateProductForm } from '@/components/CreateProductForm';

export default async function NewProductPage() {
  const session = await getSession();

  // Guard de autorización del lado del servidor: ni siquiera se envía el
  // formulario al navegador si el usuario no tiene el rol correcto. La
  // validación "de verdad" sigue viviendo en catalog-service (nunca hay
  // que confiar solo en el guard del frontend), pero esto evita que un
  // buyer vea el formulario y reciba un error confuso al enviarlo.
  if (!session) {
    redirect('/login');
  }
  if (session.role !== 'seller' && session.role !== 'admin') {
    redirect('/');
  }

  return <CreateProductForm />;
}

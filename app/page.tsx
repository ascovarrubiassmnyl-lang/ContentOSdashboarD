import { redirect } from 'next/navigation';
import { getSessionUser, isAuthEnabled } from '@/lib/auth';
import LandingPage from '@/components/landing/LandingPage';

export default async function Home() {
  if (!isAuthEnabled()) {
    redirect('/resumen');
  }

  const user = await getSessionUser();
  if (user) {
    redirect('/resumen');
  }

  return <LandingPage />;
}

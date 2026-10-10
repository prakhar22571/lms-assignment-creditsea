'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getSession, homeFor } from '@/lib/auth';
import { Loading } from '@/components/ui';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const session = getSession();
    router.replace(session ? homeFor(session.user.role) : '/login');
  }, [router]);
  return <Loading />;
}

'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getSession, homeFor } from '@/lib/auth';
import { Loading } from '@/components/ui';

export default function DashboardIndex() {
  const router = useRouter();
  useEffect(() => {
    const session = getSession();
    if (session) router.replace(homeFor(session.user.role));
  }, [router]);
  return <Loading />;
}

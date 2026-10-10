'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { modulesFor, useRequireRole } from '@/lib/auth';
import TopBar from '@/components/TopBar';
import { Alert, Loading } from '@/components/ui';

const STAFF = ['admin', 'sales', 'sanction', 'disbursement', 'collection'] as const;

export default function DashboardLayout({ children }: LayoutProps<'/dashboard'>) {
  const user = useRequireRole(STAFF);
  const pathname = usePathname();
  if (!user) return <Loading />;

  const modules = modulesFor(user.role);
  const current = pathname.split('/')[2];
  const allowed = !current || modules.some((m) => m.key === current);

  return (
    <>
      <TopBar user={user} />
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
          {modules.map((m) => (
            <Link
              key={m.key}
              href={`/dashboard/${m.key}`}
              className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium ${
                m.key === current ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {m.label}
            </Link>
          ))}
        </div>
      </nav>
      <main className="mx-auto w-full max-w-6xl p-4 sm:py-8">
        {allowed ? children : <Alert title="403 · You don't have access to this module." />}
      </main>
    </>
  );
}

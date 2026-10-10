'use client';

import { useRouter } from 'next/navigation';
import { clearSession, type SessionUser } from '@/lib/auth';

export default function TopBar({ user }: { user: SessionUser }) {
  const router = useRouter();
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <span className="font-semibold text-indigo-700">LMS</span>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-slate-600 sm:inline">
            {user.name} · <span className="capitalize">{user.role}</span>
          </span>
          <button
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
            onClick={() => {
              clearSession();
              router.replace('/login');
            }}
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}

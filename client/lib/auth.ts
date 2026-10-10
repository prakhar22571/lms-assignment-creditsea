'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';

export type Role = 'admin' | 'sales' | 'sanction' | 'disbursement' | 'collection' | 'borrower';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export const MODULES = [
  { key: 'sales', label: 'Sales', roles: ['sales', 'admin'] },
  { key: 'sanction', label: 'Sanction', roles: ['sanction', 'admin'] },
  { key: 'disbursement', label: 'Disbursement', roles: ['disbursement', 'admin'] },
  { key: 'collection', label: 'Collection', roles: ['collection', 'admin'] },
] as const satisfies readonly { key: string; label: string; roles: readonly Role[] }[];

export const modulesFor = (role: Role) => MODULES.filter((m) => (m.roles as readonly Role[]).includes(role));

export const homeFor = (role: Role) =>
  role === 'borrower' ? '/apply' : `/dashboard/${modulesFor(role)[0]?.key ?? ''}`;

const KEY = 'lms_session';
type Session = { token: string; user: SessionUser };

const parse = (raw: string | null): Session | null => {
  try {
    return JSON.parse(raw ?? 'null');
  } catch {
    return null;
  }
};

export const getSession = () => parse(localStorage.getItem(KEY));
export const getToken = () => getSession()?.token;
export const saveSession = (token: string, user: SessionUser) => localStorage.setItem(KEY, JSON.stringify({ token, user }));
export const clearSession = () => localStorage.removeItem(KEY);

const subscribe = (cb: () => void) => {
  window.addEventListener('storage', cb);
  return () => window.removeEventListener('storage', cb);
};

/** Session from localStorage; `undefined` during SSR/hydration, `null` when signed out. */
function useSession(): Session | null | undefined {
  const raw = useSyncExternalStore(subscribe, () => localStorage.getItem(KEY), () => undefined);
  return useMemo(() => (raw === undefined ? undefined : parse(raw)), [raw]);
}

/**
 * Client-side route guard. Redirects to /login when signed out, or to the user's
 * own home when their role isn't allowed. The API enforces the same rules independently.
 */
export function useRequireRole(allowed: readonly Role[]): SessionUser | null {
  const router = useRouter();
  const session = useSession();
  const permitted = !!session && allowed.includes(session.user.role);

  useEffect(() => {
    if (session === undefined || permitted) return;
    router.replace(session ? homeFor(session.user.role) : '/login');
  }, [session, permitted, router]);

  return permitted ? session.user : null;
}

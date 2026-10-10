'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import { getSession, homeFor, saveSession, type SessionUser } from '@/lib/auth';
import { Alert, Button, Card, Field, Input } from './ui';

export default function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isSignup = mode === 'signup';

  useEffect(() => {
    const session = getSession();
    if (session) router.replace(homeFor(session.user.role));
  }, [router]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const body = Object.fromEntries(new FormData(e.currentTarget));
      const { token, user } = await api<{ token: string; user: SessionUser }>(`/auth/${mode}`, { body });
      saveSession(token, user);
      router.replace(homeFor(user.role));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-slate-900">{isSignup ? 'Create your account' : 'Sign in'}</h1>
        <p className="mt-1 text-sm text-slate-500">Loan Management System</p>
        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          {isSignup && (
            <Field label="Name">
              <Input name="name" required autoComplete="name" />
            </Field>
          )}
          <Field label="Email">
            <Input name="email" type="email" required autoComplete="email" />
          </Field>
          <Field label="Password" hint={isSignup ? 'At least 8 characters' : undefined}>
            <Input
              name="password"
              type="password"
              required
              minLength={isSignup ? 8 : undefined}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
            />
          </Field>
          {error && <Alert title={error} />}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Please wait…' : isSignup ? 'Sign up' : 'Sign in'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          {isSignup ? 'Already registered? ' : 'New borrower? '}
          <Link href={isSignup ? '/login' : '/signup'} className="font-medium text-indigo-600 hover:underline">
            {isSignup ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
      </Card>
    </main>
  );
}

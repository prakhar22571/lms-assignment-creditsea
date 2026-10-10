'use client';

import { useState, type FormEvent } from 'react';
import { api, ApiError, errorMessage } from '@/lib/api';
import { todayISO } from '@/lib/loan';
import { Alert, Button, Field, Input, Select } from '../ui';

export interface Profile {
  fullName: string;
  pan: string;
  dob: string;
  monthlySalary: number;
  employmentMode: 'salaried' | 'self-employed' | 'unemployed';
}

export default function DetailsStep({ initial, onDone }: { initial?: Profile; onDone: (p: Profile) => void }) {
  const [error, setError] = useState<{ title: string; items?: string[] } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const body = Object.fromEntries(new FormData(e.currentTarget));
      const { profile } = await api<{ profile: Profile }>('/borrower/profile', { method: 'PUT', body });
      onDone(profile);
    } catch (err) {
      // 422 = BRE rejection: show every failed rule.
      setError(
        err instanceof ApiError && err.errors.length
          ? { title: 'Sorry, you are not eligible for a loan:', items: err.errors }
          : { title: errorMessage(err) },
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <Input name="fullName" required defaultValue={initial?.fullName} autoComplete="name" />
        </Field>
        <Field label="PAN" hint="Format: ABCDE1234F">
          <Input
            name="pan"
            required
            maxLength={10}
            defaultValue={initial?.pan}
            pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]"
            title="5 letters, 4 digits, 1 letter"
            className="uppercase"
          />
        </Field>
        <Field label="Date of birth">
          <Input
            name="dob"
            type="date"
            required
            max={todayISO()}
            defaultValue={initial?.dob?.slice(0, 10)}
          />
        </Field>
        <Field label="Monthly salary (₹)">
          <Input name="monthlySalary" type="number" min={0} step="any" required defaultValue={initial?.monthlySalary} />
        </Field>
        <Field label="Employment mode">
          <Select name="employmentMode" required defaultValue={initial?.employmentMode ?? ''}>
            <option value="" disabled>
              Select…
            </option>
            <option value="salaried">Salaried</option>
            <option value="self-employed">Self-Employed</option>
            <option value="unemployed">Unemployed</option>
          </Select>
        </Field>
      </div>
      {error && <Alert title={error.title} items={error.items} />}
      <Button type="submit" disabled={busy}>
        {busy ? 'Checking eligibility…' : 'Check eligibility & continue'}
      </Button>
    </form>
  );
}

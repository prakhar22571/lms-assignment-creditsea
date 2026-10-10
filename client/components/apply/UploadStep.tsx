'use client';

import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import { Alert, Button, Field } from '../ui';

const MAX_BYTES = 5 * 1024 * 1024;

export default function UploadStep({ current, onDone }: { current?: string; onDone: (name: string) => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const file = new FormData(e.currentTarget).get('file') as File | null;
    if (!file?.size) return current ? onDone(current) : setError('Choose a file to upload');
    // Quick UX check; the server enforces type and size.
    if (file.size > MAX_BYTES) return setError('File must be 5 MB or smaller');
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { salarySlip } = await api<{ salarySlip: string }>('/borrower/salary-slip', { form });
      onDone(salarySlip);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Salary slip" hint="PDF, JPG or PNG · max 5 MB">
        <input
          name="file"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
        />
      </Field>
      {current && <p className="text-sm text-slate-600">Uploaded: {current}</p>}
      {error && <Alert title={error} />}
      <Button type="submit" disabled={busy}>
        {busy ? 'Uploading…' : 'Upload & continue'}
      </Button>
    </form>
  );
}

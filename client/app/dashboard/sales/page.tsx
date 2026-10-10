'use client';

import { formatDate } from '@/lib/loan';
import { Card } from '@/components/ui';
import { ModulePage, useList } from '@/components/dashboard/shared';

interface Lead {
  _id: string;
  name: string;
  email: string;
  createdAt: string;
  profileDone: boolean;
  slipUploaded: boolean;
}

const Check = ({ ok, label }: { ok: boolean; label: string }) => (
  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ok ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
    {ok ? '✓' : '○'} {label}
  </span>
);

export default function SalesPage() {
  const { items, error } = useList<Lead>('/ops/sales', 'leads');
  return (
    <ModulePage
      title="Sales · Leads"
      subtitle="Registered borrowers who haven't applied for a loan yet."
      items={items}
      error={error}
      empty="No open leads. Every registered borrower has applied."
      render={(lead) => (
        <Card key={lead._id} className="space-y-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{lead.name}</p>
            <p className="truncate text-sm text-slate-500">{lead.email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Check ok={lead.profileDone} label="Personal details" />
            <Check ok={lead.slipUploaded} label="Salary slip" />
            <span className="ml-auto text-xs text-slate-500">
              Registered {formatDate(lead.createdAt)}
            </span>
          </div>
        </Card>
      )}
    />
  );
}

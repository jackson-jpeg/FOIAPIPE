import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useToast } from '@/components/ui/Toast';
import { Plus, ChevronLeft, ChevronRight, X } from 'lucide-react';
import * as analyticsApi from '@/api/analytics';

const TRANSACTION_TYPES = [
  { value: 'youtube_adsense', label: 'YouTube AdSense', isIncome: true },
  { value: 'sponsorship', label: 'Sponsorship', isIncome: true },
  { value: 'licensing', label: 'Licensing', isIncome: true },
  { value: 'other_income', label: 'Other Income', isIncome: true },
  { value: 'foia_cost', label: 'FOIA Cost', isIncome: false },
  { value: 'editing_cost', label: 'Editing Cost', isIncome: false },
  { value: 'equipment', label: 'Equipment', isIncome: false },
  { value: 'other_expense', label: 'Other Expense', isIncome: false },
];

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  description: string | null;
  transaction_date: string;
  is_income: boolean;
  video_id: string | null;
  foia_request_id: string | null;
}

interface RevenueTransactionsTableProps {
  range: string;
}

export function RevenueTransactionsTable({ range }: RevenueTransactionsTableProps) {
  const { addToast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pageSize = 10;

  const [form, setForm] = useState({
    transaction_type: 'youtube_adsense',
    amount: '',
    description: '',
    transaction_date: new Date().toISOString().split('T')[0],
  });

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { range, page, page_size: pageSize };
      if (typeFilter) params.type = typeFilter;
      const result = await analyticsApi.getRevenueTransactions(params);
      setTransactions(result.items || []);
      setTotal(result.total || 0);
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [range, page, typeFilter]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    setPage(1);
  }, [range, typeFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) return;

    setSubmitting(true);
    try {
      const typeDef = TRANSACTION_TYPES.find(t => t.value === form.transaction_type);
      await analyticsApi.createTransaction({
        transaction_type: form.transaction_type,
        amount: parseFloat(form.amount),
        description: form.description || null,
        transaction_date: form.transaction_date,
        is_income: typeDef?.isIncome ?? true,
      });
      addToast({ type: 'success', title: 'Transaction created' });
      setShowForm(false);
      setForm({
        transaction_type: 'youtube_adsense',
        amount: '',
        description: '',
        transaction_date: new Date().toISOString().split('T')[0],
      });
      fetchTransactions();
    } catch {
      addToast({ type: 'error', title: 'Failed to create transaction' });
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize);
  const typeLabel = (type: string) => TRANSACTION_TYPES.find(t => t.value === type)?.label || type;

  return (
    <Card
      title="Revenue Transactions"
      action={
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/20 transition-colors"
        >
          {showForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {showForm ? 'Cancel' : 'Add'}
        </button>
      }
    >
      {/* Add Transaction Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 rounded-lg bg-surface-tertiary/30 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-2xs text-text-tertiary mb-1">Type</label>
              <select
                value={form.transaction_type}
                onChange={e => setForm(f => ({ ...f, transaction_type: e.target.value }))}
                className="w-full rounded-md bg-surface-primary border border-surface-border px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
              >
                {TRANSACTION_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-2xs text-text-tertiary mb-1">Amount ($)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
                required
                className="w-full rounded-md bg-surface-primary border border-surface-border px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
              />
            </div>
            <div>
              <label className="block text-2xs text-text-tertiary mb-1">Date</label>
              <input
                type="date"
                value={form.transaction_date}
                onChange={e => setForm(f => ({ ...f, transaction_date: e.target.value }))}
                required
                className="w-full rounded-md bg-surface-primary border border-surface-border px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
              />
            </div>
            <div>
              <label className="block text-2xs text-text-tertiary mb-1">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional note"
                className="w-full rounded-md bg-surface-primary border border-surface-border px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-accent-primary text-white hover:bg-accent-primary/90 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Transaction'}
            </button>
          </div>
        </form>
      )}

      {/* Type Filter */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xs text-text-quaternary">Filter:</span>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="rounded-md bg-surface-tertiary/50 border border-surface-border/50 px-2 py-1 text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent-primary"
        >
          <option value="">All types</option>
          {TRANSACTION_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <span className="ml-auto text-2xs text-text-quaternary tabular-nums">{total} total</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-8 text-center text-sm text-text-tertiary">Loading...</div>
      ) : transactions.length === 0 ? (
        <p className="text-sm text-text-tertiary text-center py-8">No transactions yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border/50">
                <th className="text-left py-2.5 px-3 text-xs font-medium text-text-secondary">Date</th>
                <th className="text-left py-2.5 px-3 text-xs font-medium text-text-secondary">Type</th>
                <th className="text-left py-2.5 px-3 text-xs font-medium text-text-secondary">Description</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-text-secondary">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((txn) => (
                <tr key={txn.id} className="border-t border-surface-border/30 hover:bg-surface-hover transition-colors">
                  <td className="py-2.5 px-3 text-text-secondary tabular-nums text-xs">{formatDate(txn.transaction_date)}</td>
                  <td className="py-2.5 px-3">
                    <Badge variant={txn.is_income ? 'success' : 'danger'} size="sm">
                      {typeLabel(txn.transaction_type)}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-3 text-text-tertiary text-xs max-w-[200px] truncate">{txn.description || '—'}</td>
                  <td className={`py-2.5 px-3 text-right tabular-nums font-medium ${txn.is_income ? 'text-accent-emerald' : 'text-accent-red'}`}>
                    {txn.is_income ? '+' : '-'}{formatCurrency(txn.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 border-t border-surface-border/30 mt-3">
          <span className="text-2xs text-text-quaternary tabular-nums">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1 rounded text-text-tertiary hover:text-text-primary disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1 rounded text-text-tertiary hover:text-text-primary disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

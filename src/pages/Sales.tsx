import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Eye, RotateCcw, X, Receipt as ReceiptIcon, CreditCard, Banknote } from 'lucide-react';
import { supabase, type Sale, type SaleItem } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import { formatCurrency, formatDateTime, generateReceiptNumber } from '@/lib/utils';

export default function Sales() {
  const { settings } = useApp();
  const symbol = settings?.currency_symbol ?? '$';

  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [loading, setLoading] = useState(true);
  const [viewSale, setViewSale] = useState<Sale | null>(null);
  const [refunding, setRefunding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('sales').select('*, customer:customers(*)').order('created_at', { ascending: false });
    setSales((data as Sale[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredSales = useMemo(() => {
    let result = sales;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.customer?.name?.toLowerCase().includes(q) ||
        s.payment_method.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
      );
    }
    if (dateFilter !== 'all') {
      const now = new Date();
      let start = new Date(0);
      if (dateFilter === 'today') start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (dateFilter === 'week') { start = new Date(now); start.setDate(now.getDate() - 7); }
      if (dateFilter === 'month') { start = new Date(now.getFullYear(), now.getMonth(), 1); }
      result = result.filter(s => new Date(s.created_at) >= start);
    }
    return result;
  }, [sales, search, dateFilter]);

  const totalRevenue = useMemo(() => filteredSales.filter(s => s.status === 'completed').reduce((s, r) => s + Number(r.total), 0), [filteredSales]);
  const totalRefunded = useMemo(() => filteredSales.filter(s => s.status === 'refunded').reduce((s, r) => s + Number(r.total), 0), [filteredSales]);

  const viewDetails = async (sale: Sale) => {
    const { data } = await supabase.from('sale_items').select('*').eq('sale_id', sale.id);
    setViewSale({ ...sale, sale_items: (data as SaleItem[]) ?? [] });
  };

  const handleRefund = async () => {
    if (!viewSale || viewSale.status === 'refunded') return;
    if (!confirm('Process refund for this sale? Stock will be returned to inventory.')) return;
    setRefunding(true);

    // Restore stock
    for (const item of viewSale.sale_items ?? []) {
      if (item.book_id) {
        const { data: book } = await supabase.from('books').select('stock').eq('id', item.book_id).maybeSingle();
        if (book) {
          await supabase.from('books').update({ stock: (book as any).stock + item.quantity }).eq('id', item.book_id);
        }
      }
    }

    // Update sale status
    await supabase.from('sales').update({ status: 'refunded' }).eq('id', viewSale.id);
    setRefunding(false);
    setViewSale(null);
    load();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Sales History</h1>
        <p className="text-slate-500 text-sm mt-1">View and manage all transactions</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-slate-500 text-xs">Total Revenue</p>
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalRevenue, symbol)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-slate-500 text-xs">Refunded</p>
          <p className="text-2xl font-bold text-red-500">{formatCurrency(totalRefunded, symbol)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer, payment method..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as any)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="week">Last 7 Days</option>
          <option value="month">This Month</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <p className="text-slate-400 text-center py-12">Loading sales...</p>
        ) : filteredSales.length === 0 ? (
          <p className="text-slate-400 text-center py-12">No sales found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Receipt</th>
                  <th className="text-left px-4 py-3 font-medium">Date & Time</th>
                  <th className="text-left px-4 py-3 font-medium">Customer</th>
                  <th className="text-left px-4 py-3 font-medium">Payment</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Total</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{generateReceiptNumber(sale.id)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDateTime(sale.created_at)}</td>
                    <td className="px-4 py-3 text-slate-900">{sale.customer?.name ?? 'Walk-in'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-slate-600 text-xs">
                        {sale.payment_method === 'card' ? <CreditCard className="w-3.5 h-3.5" /> : <Banknote className="w-3.5 h-3.5" />}
                        {sale.payment_method}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        sale.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}>{sale.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(Number(sale.total), symbol)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => viewDetails(sale)} className="p-1.5 rounded hover:bg-slate-200 text-slate-500"><Eye className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sale detail modal */}
      {viewSale && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setViewSale(null)}>
          <div className="bg-white rounded-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 flex items-center gap-2"><ReceiptIcon className="w-5 h-5" /> Sale Details</h3>
              <button onClick={() => setViewSale(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="text-sm space-y-1 mb-4 pb-4 border-b border-slate-100">
              <div className="flex justify-between"><span className="text-slate-400">Receipt #</span><span className="font-mono text-slate-600">{generateReceiptNumber(viewSale.id)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Date</span><span className="text-slate-600">{formatDateTime(viewSale.created_at)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Customer</span><span className="text-slate-600">{viewSale.customer?.name ?? 'Walk-in'}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Payment</span><span className="text-slate-600 capitalize">{viewSale.payment_method}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Status</span><span className={`capitalize font-medium ${viewSale.status === 'completed' ? 'text-emerald-600' : 'text-red-600'}`}>{viewSale.status}</span></div>
            </div>
            <div className="space-y-2 mb-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Items</p>
              {(viewSale.sale_items ?? []).map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-slate-600">{item.quantity}× {item.book_title}</span>
                  <span className="text-slate-900 font-medium">{formatCurrency(Number(item.line_total), symbol)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 pt-3 space-y-1 text-sm">
              <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{formatCurrency(Number(viewSale.subtotal), symbol)}</span></div>
              {Number(viewSale.discount_amount) > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>-{formatCurrency(Number(viewSale.discount_amount), symbol)}</span></div>}
              <div className="flex justify-between text-slate-500"><span>Tax</span><span>{formatCurrency(Number(viewSale.tax_amount), symbol)}</span></div>
              <div className="flex justify-between font-bold text-slate-900 text-base pt-1"><span>Total</span><span>{formatCurrency(Number(viewSale.total), symbol)}</span></div>
            </div>
            {viewSale.status === 'completed' && (
              <button
                onClick={handleRefund}
                disabled={refunding}
                className="w-full mt-5 py-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" /> {refunding ? 'Processing...' : 'Process Refund'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

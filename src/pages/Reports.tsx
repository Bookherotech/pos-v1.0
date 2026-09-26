import { useState, useEffect, useCallback, useMemo } from 'react';
import { TrendingUp, DollarSign, ShoppingBag, CreditCard, BarChart3, BookOpen } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import { formatCurrency, getLastNMonths } from '@/lib/utils';

export default function Reports() {
  const { settings } = useApp();
  const symbol = settings?.currency_symbol ?? '$';

  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<{ label: string; revenue: number; count: number }[]>([]);
  const [categorySales, setCategorySales] = useState<{ name: string; revenue: number; qty: number }[]>([]);
  const [topBooks, setTopBooks] = useState<{ title: string; author: string; qty: number; revenue: number }[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<{ method: string; count: number; total: number }[]>([]);
  const [summary, setSummary] = useState({ totalRevenue: 0, totalSales: 0, avgSale: 0, totalBooks: 0, totalUnits: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    const months = getLastNMonths(6);

    // Monthly revenue
    const monthResults = await Promise.all(
      months.map(async (m) => {
        const { data } = await supabase
          .from('sales')
          .select('total')
          .eq('status', 'completed')
          .gte('created_at', m.start)
          .lt('created_at', m.end);
        const revenue = data?.reduce((s, r) => s + Number(r.total), 0) ?? 0;
        return { label: m.label, revenue, count: data?.length ?? 0 };
      })
    );
    setMonthlyData(monthResults);

    // All-time summary
    const { data: allSales } = await supabase.from('sales').select('total, payment_method').eq('status', 'completed');
    const totalRevenue = allSales?.reduce((s, r) => s + Number(r.total), 0) ?? 0;
    const totalSales = allSales?.length ?? 0;
    setSummary({
      totalRevenue,
      totalSales,
      avgSale: totalSales > 0 ? totalRevenue / totalSales : 0,
      totalBooks: 0,
      totalUnits: 0,
    });

    // Payment breakdown
    const payMap = new Map<string, { count: number; total: number }>();
    (allSales ?? []).forEach((s: any) => {
      const existing = payMap.get(s.payment_method) ?? { count: 0, total: 0 };
      existing.count += 1;
      existing.total += Number(s.total);
      payMap.set(s.payment_method, existing);
    });
    setPaymentBreakdown(Array.from(payMap.entries()).map(([method, v]) => ({ method, ...v })));

    // Top books (all time)
    const { data: items } = await supabase.from('sale_items').select('book_title, quantity, line_total, sale:sales!inner(status)').eq('sale.status', 'completed');
    const bookMap = new Map<string, { title: string; author: string; qty: number; revenue: number }>();
    let totalUnits = 0;
    (items ?? []).forEach((item: any) => {
      const existing = bookMap.get(item.book_title) ?? { title: item.book_title, author: '', qty: 0, revenue: 0 };
      existing.qty += item.quantity;
      existing.revenue += Number(item.line_total);
      bookMap.set(item.book_title, existing);
      totalUnits += item.quantity;
    });
    const top = Array.from(bookMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    setTopBooks(top);
    setSummary(prev => ({ ...prev, totalUnits }));

    // Category sales
    const { data: catItems } = await supabase
      .from('sale_items')
      .select('quantity, line_total, book:books!inner(category_id), sale:sales!inner(status)')
      .eq('sale.status', 'completed');
    const { data: categories } = await supabase.from('categories').select('id, name');
    const catMap = new Map<string, { name: string; revenue: number; qty: number }>();
    (categories ?? []).forEach((c: any) => catMap.set(c.id, { name: c.name, revenue: 0, qty: 0 }));
    (catItems ?? []).forEach((item: any) => {
      const catId = item.book?.category_id;
      if (catId) {
        const existing = catMap.get(catId);
        if (existing) {
          existing.revenue += Number(item.line_total);
          existing.qty += item.quantity;
        }
      }
    });
    setCategorySales(Array.from(catMap.values()).filter(c => c.revenue > 0).sort((a, b) => b.revenue - a.revenue));

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const maxRevenue = useMemo(() => Math.max(...monthlyData.map(m => m.revenue), 1), [monthlyData]);
  const maxCatRevenue = useMemo(() => Math.max(...categorySales.map(c => c.revenue), 1), [categorySales]);

  if (loading) return <div className="p-8 text-slate-400">Loading reports...</div>;

  const stats = [
    { label: 'Total Revenue', value: formatCurrency(summary.totalRevenue, symbol), icon: DollarSign, color: 'emerald' },
    { label: 'Total Sales', value: summary.totalSales.toString(), icon: ShoppingBag, color: 'blue' },
    { label: 'Average Sale', value: formatCurrency(summary.avgSale, symbol), icon: TrendingUp, color: 'violet' },
    { label: 'Units Sold', value: summary.totalUnits.toString(), icon: BookOpen, color: 'amber' },
  ];

  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Reports & Analytics</h1>
        <p className="text-slate-500 text-sm mt-1">Sales performance and business insights</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className={`w-11 h-11 rounded-lg flex items-center justify-center mb-3 ${colorMap[stat.color]}`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-slate-500 text-sm">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Monthly Revenue Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-blue-500" /> Monthly Revenue (6 months)</h2>
          <div className="flex items-end justify-between gap-3 h-48">
            {monthlyData.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg transition-all hover:from-blue-600 hover:to-blue-500 relative group"
                    style={{ height: `${(m.revenue / maxRevenue) * 100}%`, minHeight: m.revenue > 0 ? '8px' : '2px' }}
                  >
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-medium text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {formatCurrency(m.revenue, symbol)}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-slate-500">{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><CreditCard className="w-4 h-4 text-violet-500" /> Payment Methods</h2>
          {paymentBreakdown.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-12">No payment data</p>
          ) : (
            <div className="space-y-4">
              {paymentBreakdown.map((p) => {
                const pct = summary.totalSales > 0 ? (p.count / summary.totalSales) * 100 : 0;
                return (
                  <div key={p.method}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-slate-700 capitalize">{p.method}</span>
                      <span className="text-sm text-slate-500">{p.count} sales · {formatCurrency(p.total, symbol)}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5">
                      <div className={`h-2.5 rounded-full ${p.method === 'card' ? 'bg-violet-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Category Performance */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-bold text-slate-900 mb-4">Revenue by Category</h2>
          {categorySales.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-12">No category data</p>
          ) : (
            <div className="space-y-3">
              {categorySales.map((c, i) => (
                <div key={c.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-slate-700">{c.name}</span>
                    <span className="text-sm text-slate-500">{formatCurrency(c.revenue, symbol)} · {c.qty} sold</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5">
                    <div className="h-2.5 rounded-full" style={{ width: `${(c.revenue / maxCatRevenue) * 100}%`, backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'][i % 7] }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Books by Revenue */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><BookOpen className="w-4 h-4 text-amber-500" /> Top Books by Revenue</h2>
          {topBooks.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-12">No sales data</p>
          ) : (
            <div className="space-y-2">
              {topBooks.map((book, i) => (
                <div key={book.title} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'
                  }`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{book.title}</p>
                    <p className="text-xs text-slate-400">{book.qty} units sold</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-900 flex-shrink-0">{formatCurrency(book.revenue, symbol)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

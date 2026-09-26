import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Package, AlertTriangle, ShoppingBag, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { supabase, type Sale, type Book } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import { formatCurrency, formatTime, getTodayRange, getWeekRange, getMonthRange } from '@/lib/utils';

type Page = 'dashboard' | 'pos' | 'inventory' | 'sales' | 'customers' | 'reports' | 'settings';

export default function Dashboard({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const { settings } = useApp();
  const [todaySales, setTodaySales] = useState<number>(0);
  const [todayCount, setTodayCount] = useState<number>(0);
  const [weekSales, setWeekSales] = useState<number>(0);
  const [monthSales, setMonthSales] = useState<number>(0);
  const [lowStockBooks, setLowStockBooks] = useState<Book[]>([]);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [topBooks, setTopBooks] = useState<{ title: string; author: string; qty: number; revenue: number }[]>([]);
  const [totalBooks, setTotalBooks] = useState<number>(0);
  const [inventoryValue, setInventoryValue] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const symbol = settings?.currency_symbol ?? '$';

  const load = useCallback(async () => {
    setLoading(true);
    const today = getTodayRange();
    const week = getWeekRange();
    const month = getMonthRange();

    const [todayRes, weekRes, monthRes, lowStockRes, recentRes, booksRes, topBooksRes] = await Promise.all([
      supabase.from('sales').select('total').gte('created_at', today.start).lt('created_at', today.end).eq('status', 'completed'),
      supabase.from('sales').select('total').gte('created_at', week.start).lt('created_at', week.end).eq('status', 'completed'),
      supabase.from('sales').select('total').gte('created_at', month.start).lt('created_at', month.end).eq('status', 'completed'),
      supabase.from('books').select('*, category:categories(*)').lt('stock', 10).order('stock', { ascending: true }).limit(8),
      supabase.from('sales').select('*, customer:customers(*)').eq('status', 'completed').order('created_at', { ascending: false }).limit(6),
      supabase.from('books').select('price, cost, stock'),
      supabase.from('sale_items').select('book_title, quantity, line_total, sale:sales!inner(status)').eq('sale.status', 'completed').gte('sale.created_at', month.start).lt('sale.created_at', month.end),
    ]);

    setTodaySales(todayRes.data?.reduce((s, r) => s + Number(r.total), 0) ?? 0);
    setTodayCount(todayRes.data?.length ?? 0);
    setWeekSales(weekRes.data?.reduce((s, r) => s + Number(r.total), 0) ?? 0);
    setMonthSales(monthRes.data?.reduce((s, r) => s + Number(r.total), 0) ?? 0);
    setLowStockBooks((lowStockRes.data as Book[]) ?? []);
    setRecentSales((recentRes.data as Sale[]) ?? []);
    setTotalBooks(booksRes.data?.length ?? 0);
    setInventoryValue(booksRes.data?.reduce((s, b) => s + Number(b.cost) * b.stock, 0) ?? 0);

    // Aggregate top books
    const bookMap = new Map<string, { title: string; qty: number; revenue: number }>();
    (topBooksRes.data ?? []).forEach((item: any) => {
      const existing = bookMap.get(item.book_title) ?? { title: item.book_title, qty: 0, revenue: 0 };
      existing.qty += item.quantity;
      existing.revenue += Number(item.line_total);
      bookMap.set(item.book_title, existing);
    });
    setTopBooks(Array.from(bookMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 5));

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="p-8 text-slate-400">Loading dashboard...</div>;

  const stats = [
    { label: "Today's Revenue", value: formatCurrency(todaySales, symbol), sub: `${todayCount} transactions`, icon: DollarSign, color: 'emerald' },
    { label: 'This Week', value: formatCurrency(weekSales, symbol), sub: 'Weekly revenue', icon: TrendingUp, color: 'blue' },
    { label: 'This Month', value: formatCurrency(monthSales, symbol), sub: 'Monthly revenue', icon: TrendingUp, color: 'violet' },
    { label: 'Inventory Value', value: formatCurrency(inventoryValue, symbol), sub: `${totalBooks} titles`, icon: Package, color: 'amber' },
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
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Overview of your bookstore performance</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${colorMap[stat.color]}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
              <p className="text-slate-400 text-xs mt-1">{stat.sub}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sales */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900">Recent Sales</h2>
            <button onClick={() => onNavigate('sales')} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              View all <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
          {recentSales.length === 0 ? (
            <p className="text-slate-400 text-sm py-8 text-center">No sales yet</p>
          ) : (
            <div className="space-y-2">
              {recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {sale.customer?.name ?? 'Walk-in customer'}
                    </p>
                    <p className="text-xs text-slate-400">{formatTime(sale.created_at)} · {sale.payment_method}</p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600 flex-shrink-0">{formatCurrency(Number(sale.total), symbol)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Alert */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Low Stock Alert
            </h2>
            <button onClick={() => onNavigate('inventory')} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              Manage <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
          {lowStockBooks.length === 0 ? (
            <p className="text-slate-400 text-sm py-8 text-center">All books well stocked</p>
          ) : (
            <div className="space-y-2">
              {lowStockBooks.map((book) => (
                <div key={book.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{book.title}</p>
                    <p className="text-xs text-slate-400">{book.author}</p>
                  </div>
                  <span className={`text-sm font-semibold px-2 py-0.5 rounded ${
                    book.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {book.stock} left
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Sellers This Month */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 lg:col-span-2">
          <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-blue-500" />
            Top Sellers This Month
          </h2>
          {topBooks.length === 0 ? (
            <p className="text-slate-400 text-sm py-8 text-center">No sales data for this month yet</p>
          ) : (
            <div className="space-y-3">
              {topBooks.map((book, i) => (
                <div key={book.title} className="flex items-center gap-4">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'
                  }`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{book.title}</p>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5">
                      <div className="bg-blue-500 rounded-full h-1.5" style={{ width: `${(book.qty / topBooks[0].qty) * 100}%` }} />
                    </div>
                  </div>
                  <span className="text-sm text-slate-500 flex-shrink-0">{book.qty} sold</span>
                  <span className="text-sm font-semibold text-slate-900 flex-shrink-0 w-20 text-right">{formatCurrency(book.revenue, symbol)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

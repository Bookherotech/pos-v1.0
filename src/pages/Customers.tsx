import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, X, Mail, Phone, Award, ShoppingBag } from 'lucide-react';
import { supabase, type Customer, type Sale } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function Customers() {
  const { settings } = useApp();
  const symbol = settings?.currency_symbol ?? '$';
  const loyaltyEnabled = settings?.loyalty_enabled ?? true;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewCustomer, setViewCustomer] = useState<{ customer: Customer; sales: Sale[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('customers').select('*').order('name');
    setCustomers((data as Customer[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search) return customers;
    const q = search.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q) || (c.phone ?? '').includes(q));
  }, [customers, search]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this customer?')) return;
    await supabase.from('customers').delete().eq('id', id);
    load();
  };

  const viewDetails = async (customer: Customer) => {
    const { data } = await supabase.from('sales').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false });
    setViewCustomer({ customer, sales: (data as Sale[]) ?? [] });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-slate-500 text-sm mt-1">Manage customer profiles and loyalty</p>
        </div>
        <button
          onClick={() => { setEditingCustomer(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium text-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Customer
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or phone..."
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      {/* Grid */}
      {loading ? (
        <p className="text-slate-400 text-center py-12">Loading customers...</p>
      ) : filtered.length === 0 ? (
        <p className="text-slate-400 text-center py-12">No customers found</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-lg font-bold flex-shrink-0">
                  {c.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{c.name}</p>
                  {c.email && <p className="text-xs text-slate-400 truncate flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</p>}
                  {c.phone && <p className="text-xs text-slate-400 truncate flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</p>}
                </div>
              </div>
              {loyaltyEnabled && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-amber-50">
                  <Award className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-700">{c.loyalty_points} loyalty points</span>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => viewDetails(c)} className="flex-1 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">View</button>
                <button onClick={() => { setEditingCustomer(c); setShowModal(true); }} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(c.id)} className="p-2 rounded-lg border border-slate-200 text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && <CustomerModal customer={editingCustomer} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />}
      {viewCustomer && <CustomerDetailModal data={viewCustomer} symbol={symbol} onClose={() => setViewCustomer(null)} />}
    </div>
  );
}

function CustomerModal({ customer, onClose, onSaved }: { customer: Customer | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: customer?.name ?? '',
    email: customer?.email ?? '',
    phone: customer?.phone ?? '',
    address: customer?.address ?? '',
    loyalty_points: customer?.loyalty_points ?? 0,
    notes: customer?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      loyalty_points: parseInt(form.loyalty_points as any) || 0,
      notes: form.notes.trim() || null,
    };
    if (customer) {
      await supabase.from('customers').update(payload).eq('id', customer.id);
    } else {
      await supabase.from('customers').insert(payload);
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900">{customer ? 'Edit Customer' : 'Add Customer'}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Address</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Loyalty Points</label>
            <input type="number" value={form.loyalty_points} onChange={(e) => setForm({ ...form, loyalty_points: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
        </div>
        {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-900 text-sm font-medium disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

function CustomerDetailModal({ data, symbol, onClose }: { data: { customer: Customer; sales: Sale[] }; symbol: string; onClose: () => void }) {
  const { customer, sales } = data;
  const totalSpent = sales.filter(s => s.status === 'completed').reduce((s, r) => s + Number(r.total), 0);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900">Customer Details</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl font-bold">{customer.name.charAt(0)}</div>
          <div>
            <p className="font-bold text-slate-900">{customer.name}</p>
            {customer.email && <p className="text-xs text-slate-400 flex items-center gap-1"><Mail className="w-3 h-3" /> {customer.email}</p>}
            {customer.phone && <p className="text-xs text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3" /> {customer.phone}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-lg bg-amber-50 p-3">
            <p className="text-xs text-amber-600">Loyalty Points</p>
            <p className="text-lg font-bold text-amber-700">{customer.loyalty_points}</p>
          </div>
          <div className="rounded-lg bg-emerald-50 p-3">
            <p className="text-xs text-emerald-600">Total Spent</p>
            <p className="text-lg font-bold text-emerald-700">{formatCurrency(totalSpent, symbol)}</p>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1"><ShoppingBag className="w-3.5 h-3.5" /> Purchase History</p>
          {sales.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">No purchases yet</p>
          ) : (
            <div className="space-y-2">
              {sales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="text-sm text-slate-900">{formatDate(sale.created_at)}</p>
                    <p className="text-xs text-slate-400 capitalize">{sale.payment_method} · {sale.status}</p>
                  </div>
                  <span className="text-sm font-medium text-slate-900">{formatCurrency(Number(sale.total), symbol)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

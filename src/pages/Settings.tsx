import { useState, useEffect, useCallback } from 'react';
import { Store, Percent, Award, Save, Plus, Trash2, X } from 'lucide-react';
import { supabase, type Category, type Settings } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';

export default function SettingsPage() {
  const { settings, reloadSettings } = useApp();
  const [form, setForm] = useState<Settings | null>(settings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showCatModal, setShowCatModal] = useState(false);
  const [newCat, setNewCat] = useState({ name: '', description: '' });

  const loadCategories = useCallback(async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    setCategories((data as Category[]) ?? []);
  }, []);

  useEffect(() => {
    setForm(settings);
    loadCategories();
  }, [settings, loadCategories]);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    await supabase.from('settings').update({
      store_name: form.store_name,
      address: form.address,
      phone: form.phone,
      email: form.email,
      tax_rate: form.tax_rate,
      currency_symbol: form.currency_symbol,
      receipt_footer: form.receipt_footer,
      low_stock_alert: form.low_stock_alert,
      loyalty_enabled: form.loyalty_enabled,
      loyalty_rate: form.loyalty_rate,
    }).eq('id', form.id);
    setSaving(false);
    setSaved(true);
    reloadSettings();
    setTimeout(() => setSaved(false), 2000);
  };

  const addCategory = async () => {
    if (!newCat.name.trim()) return;
    await supabase.from('categories').insert({ name: newCat.name.trim(), description: newCat.description.trim() || null });
    setNewCat({ name: '', description: '' });
    setShowCatModal(false);
    loadCategories();
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Delete this category? Books in this category will be uncategorized.')) return;
    await supabase.from('categories').delete().eq('id', id);
    loadCategories();
  };

  if (!form) return <div className="p-8 text-slate-400">Loading settings...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Configure your store and preferences</p>
      </div>

      <div className="space-y-6">
        {/* Store Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Store className="w-5 h-5 text-blue-500" /> Store Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Store Name</label>
              <input value={form.store_name} onChange={(e) => setForm({ ...form, store_name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Phone</label>
              <input value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Email</label>
              <input type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Address</label>
              <input value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </div>
        </div>

        {/* Tax & Currency */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Percent className="w-5 h-5 text-emerald-500" /> Tax & Currency</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Tax Rate (%)</label>
              <input type="number" step="0.01" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Currency Symbol</label>
              <input value={form.currency_symbol} onChange={(e) => setForm({ ...form, currency_symbol: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </div>
        </div>

        {/* Loyalty */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Award className="w-5 h-5 text-amber-500" /> Loyalty Program</h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.loyalty_enabled} onChange={(e) => setForm({ ...form, loyalty_enabled: e.target.checked })} className="w-5 h-5 rounded text-amber-500 focus:ring-amber-400" />
              <span className="text-sm text-slate-700">Enable loyalty points</span>
            </label>
            {form.loyalty_enabled && (
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Points earned per dollar spent</label>
                <input type="number" step="0.01" value={form.loyalty_rate} onChange={(e) => setForm({ ...form, loyalty_rate: parseFloat(e.target.value) || 0 })} className="w-full max-w-xs px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
            )}
          </div>
        </div>

        {/* Receipt */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-bold text-slate-900 mb-4">Receipt Footer</h2>
          <input value={form.receipt_footer ?? ''} onChange={(e) => setForm({ ...form, receipt_footer: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>

        {/* Categories */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900">Book Categories</h2>
            <button onClick={() => setShowCatModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-medium text-slate-700">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-sm">
                <span className="text-slate-700">{c.name}</span>
                <button onClick={() => deleteCategory(c.id)} className="text-slate-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium text-sm transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {saved && <span className="text-sm text-emerald-600 font-medium">Settings saved!</span>}
        </div>
      </div>

      {/* Add category modal */}
      {showCatModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowCatModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">Add Category</h3>
              <button onClick={() => setShowCatModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Name *</label>
                <input value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Description</label>
                <input value={newCat.description} onChange={(e) => setNewCat({ ...newCat, description: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowCatModal(false)} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={addCategory} className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-900 text-sm font-medium">Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

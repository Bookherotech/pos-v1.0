import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, Package, AlertTriangle, X, TrendingUp, Filter } from 'lucide-react';
import { supabase, type Book, type Category, type StockAdjustment } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import { formatCurrency, formatDate } from '@/lib/utils';

type SortKey = 'title' | 'stock' | 'price' | 'author';

export default function Inventory() {
  const { settings } = useApp();
  const symbol = settings?.currency_symbol ?? '$';

  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [sortBy, setSortBy] = useState<SortKey>('title');
  const [loading, setLoading] = useState(true);
  const [showBookModal, setShowBookModal] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustingBook, setAdjustingBook] = useState<Book | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyBook, setHistoryBook] = useState<Book | null>(null);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [booksRes, catsRes] = await Promise.all([
      supabase.from('books').select('*, category:categories(*)').order('title'),
      supabase.from('categories').select('*').order('name'),
    ]);
    setBooks((booksRes.data as Book[]) ?? []);
    setCategories((catsRes.data as Category[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredBooks = useMemo(() => {
    let result = books;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || (b.isbn ?? '').includes(q));
    }
    if (categoryFilter !== 'all') {
      result = result.filter(b => b.category_id === categoryFilter);
    }
    if (stockFilter === 'low') result = result.filter(b => b.stock <= b.low_stock_threshold && b.stock > 0);
    if (stockFilter === 'out') result = result.filter(b => b.stock <= 0);

    return [...result].sort((a, b) => {
      switch (sortBy) {
        case 'title': return a.title.localeCompare(b.title);
        case 'author': return a.author.localeCompare(b.author);
        case 'stock': return a.stock - b.stock;
        case 'price': return Number(b.price) - Number(a.price);
      }
    });
  }, [books, search, categoryFilter, stockFilter, sortBy]);

  const stats = useMemo(() => ({
    total: books.length,
    lowStock: books.filter(b => b.stock <= b.low_stock_threshold && b.stock > 0).length,
    outOfStock: books.filter(b => b.stock <= 0).length,
    inventoryValue: books.reduce((s, b) => s + Number(b.cost) * b.stock, 0),
  }), [books]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this book? This cannot be undone.')) return;
    await supabase.from('books').delete().eq('id', id);
    load();
  };

  const loadAdjustments = async (bookId: string) => {
    const { data } = await supabase.from('stock_adjustments').select('*, book:books(*)').eq('book_id', bookId).order('created_at', { ascending: false });
    setAdjustments((data as StockAdjustment[]) ?? []);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your book catalog and stock levels</p>
        </div>
        <button
          onClick={() => { setEditingBook(null); setShowBookModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium text-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Book
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><Package className="w-5 h-5" /></div>
            <div><p className="text-slate-500 text-xs">Total Titles</p><p className="text-xl font-bold text-slate-900">{stats.total}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><AlertTriangle className="w-5 h-5" /></div>
            <div><p className="text-slate-500 text-xs">Low Stock</p><p className="text-xl font-bold text-slate-900">{stats.lowStock}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center"><AlertTriangle className="w-5 h-5" /></div>
            <div><p className="text-slate-500 text-xs">Out of Stock</p><p className="text-xl font-bold text-slate-900">{stats.outOfStock}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><TrendingUp className="w-5 h-5" /></div>
            <div><p className="text-slate-500 text-xs">Inventory Value</p><p className="text-xl font-bold text-slate-900">{formatCurrency(stats.inventoryValue, symbol)}</p></div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search books..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
            <option value="all">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value as any)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
            <option value="all">All Stock</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
            <option value="title">Sort: Title</option>
            <option value="author">Sort: Author</option>
            <option value="stock">Sort: Stock</option>
            <option value="price">Sort: Price</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <p className="text-slate-400 text-center py-12">Loading inventory...</p>
        ) : filteredBooks.length === 0 ? (
          <p className="text-slate-400 text-center py-12">No books found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Book</th>
                  <th className="text-left px-4 py-3 font-medium">Category</th>
                  <th className="text-left px-4 py-3 font-medium">ISBN</th>
                  <th className="text-right px-4 py-3 font-medium">Price</th>
                  <th className="text-right px-4 py-3 font-medium">Cost</th>
                  <th className="text-center px-4 py-3 font-medium">Stock</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBooks.map((book) => (
                  <tr key={book.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900 line-clamp-1">{book.title}</p>
                      <p className="text-xs text-slate-400">{book.author}</p>
                    </td>
                    <td className="px-4 py-3"><span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">{book.category?.name ?? '—'}</span></td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{book.isbn ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">{formatCurrency(Number(book.price), symbol)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{formatCurrency(Number(book.cost), symbol)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        book.stock <= 0 ? 'bg-red-100 text-red-700' : book.stock <= book.low_stock_threshold ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                      }`}>{book.stock}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setAdjustingBook(book); setShowAdjustModal(true); }} title="Adjust stock" className="p-1.5 rounded hover:bg-slate-200 text-slate-500"><TrendingUp className="w-4 h-4" /></button>
                        <button onClick={() => { setHistoryBook(book); loadAdjustments(book.id); setShowHistoryModal(true); }} title="Stock history" className="p-1.5 rounded hover:bg-slate-200 text-slate-500"><Package className="w-4 h-4" /></button>
                        <button onClick={() => { setEditingBook(book); setShowBookModal(true); }} title="Edit" className="p-1.5 rounded hover:bg-slate-200 text-slate-500"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(book.id)} title="Delete" className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showBookModal && <BookModal book={editingBook} categories={categories} onClose={() => setShowBookModal(false)} onSaved={() => { setShowBookModal(false); load(); }} />}
      {showAdjustModal && adjustingBook && <AdjustStockModal book={adjustingBook} onClose={() => setShowAdjustModal(false)} onSaved={() => { setShowAdjustModal(false); load(); }} />}
      {showHistoryModal && historyBook && <StockHistoryModal book={historyBook} adjustments={adjustments} onClose={() => setShowHistoryModal(false)} />}
    </div>
  );
}

function BookModal({ book, categories, onClose, onSaved }: { book: Book | null; categories: Category[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: book?.title ?? '',
    author: book?.author ?? '',
    isbn: book?.isbn ?? '',
    category_id: book?.category_id ?? '',
    price: book?.price ?? '',
    cost: book?.cost ?? '',
    stock: book?.stock ?? 0,
    low_stock_threshold: book?.low_stock_threshold ?? 5,
    publisher: book?.publisher ?? '',
    published_year: book?.published_year ?? '',
    description: book?.description ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!form.title.trim() || !form.author.trim()) { setError('Title and author are required'); return; }
    setSaving(true);
    setError('');
    const payload = {
      title: form.title.trim(),
      author: form.author.trim(),
      isbn: form.isbn.trim() || null,
      category_id: form.category_id || null,
      price: parseFloat(form.price as any) || 0,
      cost: parseFloat(form.cost as any) || 0,
      stock: parseInt(form.stock as any) || 0,
      low_stock_threshold: parseInt(form.low_stock_threshold as any) || 5,
      publisher: form.publisher.trim() || null,
      published_year: form.published_year ? parseInt(form.published_year as any) : null,
      description: form.description.trim() || null,
    };
    if (book) {
      await supabase.from('books').update(payload).eq('id', book.id);
    } else {
      await supabase.from('books').insert(payload);
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900">{book ? 'Edit Book' : 'Add New Book'}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Title *</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Author *</label>
              <input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">ISBN</label>
              <input value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Category</label>
              <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                <option value="">None</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Price</label>
              <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Cost</label>
              <input type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Stock</label>
              <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Low Stock Alert</label>
              <input type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Publisher</label>
              <input value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Year</label>
              <input type="number" value={form.published_year} onChange={(e) => setForm({ ...form, published_year: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
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

function AdjustStockModal({ book, onClose, onSaved }: { book: Book; onClose: () => void; onSaved: () => void }) {
  const [newStock, setNewStock] = useState(book.stock);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const adjustment = newStock - book.stock;

  const save = async () => {
    if (!reason.trim()) return;
    setSaving(true);
    await supabase.from('stock_adjustments').insert({
      book_id: book.id,
      old_stock: book.stock,
      new_stock: newStock,
      adjustment: adjustment,
      reason: reason.trim(),
    });
    await supabase.from('books').update({ stock: newStock }).eq('id', book.id);
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900">Adjust Stock</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <p className="text-sm text-slate-500 mb-1">{book.title}</p>
        <p className="text-xs text-slate-400 mb-4">Current stock: {book.stock} units</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">New Stock Level</label>
            <input type="number" value={newStock} onChange={(e) => setNewStock(parseInt(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Reason *</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
              <option value="">Select reason...</option>
              <option value="Restock">Restock</option>
              <option value="Damage">Damage</option>
              <option value="Shrinkage/Theft">Shrinkage/Theft</option>
              <option value="Recount">Recount</option>
              <option value="Return to supplier">Return to supplier</option>
              <option value="Other">Other</option>
            </select>
          </div>
          {adjustment !== 0 && (
            <p className={`text-sm font-medium ${adjustment > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {adjustment > 0 ? '+' : ''}{adjustment} units
            </p>
          )}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={save} disabled={saving || !reason.trim()} className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-900 text-sm font-medium disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

function StockHistoryModal({ book, adjustments, onClose }: { book: Book; adjustments: StockAdjustment[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900">Stock History</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <p className="text-sm text-slate-500 mb-4">{book.title}</p>
        {adjustments.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">No stock adjustments recorded</p>
        ) : (
          <div className="space-y-2">
            {adjustments.map((adj) => (
              <div key={adj.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-900">{adj.reason}</p>
                  <p className="text-xs text-slate-400">{formatDate(adj.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-medium ${adj.adjustment > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {adj.adjustment > 0 ? '+' : ''}{adj.adjustment}
                  </p>
                  <p className="text-xs text-slate-400">{adj.old_stock} → {adj.new_stock}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

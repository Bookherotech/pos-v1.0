import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Plus, Minus, Trash2, ShoppingCart, X, CreditCard, Banknote, Percent, UserPlus, Check, Printer } from 'lucide-react';
import { supabase, type Book, type Customer, type CartItem } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import { formatCurrency, generateReceiptNumber, formatDateTime } from '@/lib/utils';

export default function POS() {
  const { settings } = useApp();
  const symbol = settings?.currency_symbol ?? '$';
  const taxRate = settings?.tax_rate ?? 8.25;
  const loyaltyEnabled = settings?.loyalty_enabled ?? true;
  const loyaltyRate = settings?.loyalty_rate ?? 1;

  const [search, setSearch] = useState('');
  const [books, setBooks] = useState<Book[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('card');
  const [amountPaid, setAmountPaid] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const loadBooks = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('books').select('*, category:categories(*)').order('title');
    setBooks((data as Book[]) ?? []);
    setLoading(false);
  }, []);

  const loadCustomers = useCallback(async () => {
    const { data } = await supabase.from('customers').select('*').order('name');
    setCustomers((data as Customer[]) ?? []);
  }, []);

  useEffect(() => {
    loadBooks();
    loadCustomers();
  }, [loadBooks, loadCustomers]);

  const filteredBooks = useMemo(() => {
    if (!search) return books;
    const q = search.toLowerCase();
    return books.filter(b =>
      b.title.toLowerCase().includes(q) ||
      b.author.toLowerCase().includes(q) ||
      (b.isbn ?? '').includes(q)
    );
  }, [books, search]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers;
    const q = customerSearch.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(q) || (c.email ?? '').includes(q) || (c.phone ?? '').includes(q));
  }, [customers, customerSearch]);

  const subtotal = useMemo(() => cart.reduce((s, item) => s + item.price * item.quantity, 0), [cart]);
  const discountAmount = useMemo(() => (subtotal * discountPercent) / 100, [subtotal, discountPercent]);
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = useMemo(() => (taxableAmount * taxRate) / 100, [taxableAmount, taxRate]);
  const total = taxableAmount + taxAmount;
  const change = useMemo(() => {
    const paid = parseFloat(amountPaid) || 0;
    return Math.max(0, paid - total);
  }, [amountPaid, total]);

  const addToCart = (book: Book) => {
    if (book.stock <= 0) return;
    setCart(prev => {
      const existing = prev.find(i => i.book_id === book.id);
      if (existing) {
        if (existing.quantity >= book.stock) return prev;
        return prev.map(i => i.book_id === book.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        book_id: book.id,
        title: book.title,
        author: book.author,
        isbn: book.isbn,
        price: Number(book.price),
        quantity: 1,
        stock: book.stock,
      }];
    });
  };

  const updateQty = (bookId: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.book_id !== bookId) return i;
      const newQty = i.quantity + delta;
      if (newQty <= 0) return i;
      if (newQty > i.stock) return i;
      return { ...i, quantity: newQty };
    }));
  };

  const setQty = (bookId: string, qty: number) => {
    setCart(prev => prev.map(i => {
      if (i.book_id !== bookId) return i;
      const clamped = Math.max(1, Math.min(qty, i.stock));
      return { ...i, quantity: clamped };
    }));
  };

  const removeFromCart = (bookId: string) => {
    setCart(prev => prev.filter(i => i.book_id !== bookId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountPercent(0);
    setAmountPaid('');
    setSelectedCustomer(null);
    setError('');
  };

  const checkout = async () => {
    if (cart.length === 0) return;
    setProcessing(true);
    setError('');

    try {
      const paid = paymentMethod === 'cash' ? (parseFloat(amountPaid) || 0) : total;
      if (paymentMethod === 'cash' && paid < total) {
        setError('Insufficient payment amount');
        setProcessing(false);
        return;
      }

      // Create sale
      const { data: sale, error: saleErr } = await supabase.from('sales').insert({
        customer_id: selectedCustomer?.id ?? null,
        subtotal: subtotal,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        total: total,
        payment_method: paymentMethod,
        amount_paid: paid,
        change_amount: change,
        status: 'completed',
      }).select().single();

      if (saleErr) throw saleErr;

      // Create sale items
      const items = cart.map(item => ({
        sale_id: sale.id,
        book_id: item.book_id,
        book_title: item.title,
        isbn: item.isbn,
        price: item.price,
        quantity: item.quantity,
        line_total: item.price * item.quantity,
      }));

      const { error: itemsErr } = await supabase.from('sale_items').insert(items);
      if (itemsErr) throw itemsErr;

      // Decrement stock
      for (const item of cart) {
        const book = books.find(b => b.id === item.book_id);
        if (book) {
          await supabase.from('books').update({ stock: book.stock - item.quantity }).eq('id', item.book_id);
        }
      }

      // Award loyalty points
      if (selectedCustomer && loyaltyEnabled) {
        const points = Math.floor(total * loyaltyRate);
        await supabase.from('customers').update({
          loyalty_points: selectedCustomer.loyalty_points + points,
        }).eq('id', selectedCustomer.id);
      }

      // Fetch sale with items for receipt
      const { data: fullSale } = await supabase
        .from('sales')
        .select('*, sale_items(*)')
        .eq('id', sale.id)
        .single();

      setLastSale({ ...fullSale, customer: selectedCustomer });
      setShowReceipt(true);
      clearCart();
      loadBooks();
      loadCustomers();
    } catch (err: any) {
      setError(err.message ?? 'Failed to process sale');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Product grid */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-6 pb-4">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Point of Sale</h1>
          <p className="text-slate-500 text-sm mb-4">Search and add books to the cart</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, author, or ISBN..."
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {loading ? (
            <p className="text-slate-400 text-center py-12">Loading books...</p>
          ) : filteredBooks.length === 0 ? (
            <p className="text-slate-400 text-center py-12">No books found</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredBooks.map((book) => {
                const out = book.stock <= 0;
    const low = book.stock <= book.low_stock_threshold;
    return (
      <button
        key={book.id}
        onClick={() => addToCart(book)}
        disabled={out}
        className={`text-left bg-white rounded-xl border p-4 transition-all hover:shadow-md ${
          out ? 'opacity-50 cursor-not-allowed border-slate-200' : 'border-slate-200 hover:border-amber-300 cursor-pointer'
        }`}
      >
        <div className="aspect-[3/4] bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg mb-3 flex items-center justify-center">
          <span className="text-slate-400 text-xs font-medium text-center px-2 line-clamp-3">{book.title}</span>
        </div>
        <p className="text-sm font-semibold text-slate-900 line-clamp-1">{book.title}</p>
        <p className="text-xs text-slate-500 line-clamp-1">{book.author}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm font-bold text-amber-600">{formatCurrency(Number(book.price), symbol)}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            out ? 'bg-red-100 text-red-600' : low ? 'bg-amber-100 text-amber-600' : 'bg-emerald-50 text-emerald-600'
          }`}>{out ? 'Out' : `${book.stock} in`}</span>
        </div>
      </button>
    );
  })}
            </div>
          )}
        </div>
      </div>

      {/* Cart panel */}
      <div className="w-96 bg-white border-l border-slate-200 flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Current Sale
            </h2>
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-sm text-red-500 hover:text-red-600 font-medium">Clear</button>
            )}
          </div>
          {/* Customer selector */}
          <button
            onClick={() => { setShowCustomerModal(true); setCustomerSearch(''); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-slate-200 hover:border-slate-300 text-sm text-left transition-colors"
          >
            {selectedCustomer ? (
              <>
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {selectedCustomer.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">{selectedCustomer.name}</p>
                  <p className="text-xs text-slate-400">{selectedCustomer.loyalty_points} pts</p>
                </div>
                <X className="w-4 h-4 text-slate-400" onClick={(e) => { e.stopPropagation(); setSelectedCustomer(null); }} />
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 text-slate-400" />
                <span className="text-slate-500">Add customer (optional)</span>
              </>
            )}
          </button>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-5">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <ShoppingCart className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-slate-400 text-sm">Cart is empty</p>
              <p className="text-slate-300 text-xs mt-1">Click a book to add it</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.book_id} className="flex gap-3 items-start">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 line-clamp-1">{item.title}</p>
                    <p className="text-xs text-slate-400 line-clamp-1">{item.author}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{formatCurrency(item.price, symbol)} each</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => updateQty(item.book_id, -1)} className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="text"
                      value={item.quantity}
                      onChange={(e) => setQty(item.book_id, parseInt(e.target.value) || 1)}
                      className="w-8 text-center text-sm font-medium border-0 focus:outline-none focus:ring-0"
                    />
                    <button onClick={() => updateQty(item.book_id, 1)} className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
                      <Plus className="w-3 h-3" />
                    </button>
                    <button onClick={() => removeFromCart(item.book_id)} className="ml-1 text-slate-300 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Checkout section */}
        {cart.length > 0 && (
          <div className="border-t border-slate-200 p-5 space-y-3">
            {/* Discount */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={discountPercent || ''}
                  onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                  placeholder="0"
                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <span className="text-sm text-slate-500">Discount %</span>
            </div>

            {/* Totals */}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal, symbol)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(discountAmount, symbol)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500">
                <span>Tax ({taxRate}%)</span>
                <span>{formatCurrency(taxAmount, symbol)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-slate-900 pt-1.5 border-t border-slate-100">
                <span>Total</span>
                <span>{formatCurrency(total, symbol)}</span>
              </div>
            </div>

            {/* Payment method */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPaymentMethod('card')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  paymentMethod === 'card' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <CreditCard className="w-4 h-4" /> Card
              </button>
              <button
                onClick={() => setPaymentMethod('cash')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  paymentMethod === 'cash' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Banknote className="w-4 h-4" /> Cash
              </button>
            </div>

            {/* Cash input */}
            {paymentMethod === 'cash' && (
              <div>
                <input
                  type="number"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="Amount paid"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                {change > 0 && (
                  <p className="text-sm text-emerald-600 mt-1.5 font-medium">Change: {formatCurrency(change, symbol)}</p>
                )}
              </div>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              onClick={checkout}
              disabled={processing}
              className="w-full py-3.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-sm transition-colors disabled:opacity-50"
            >
              {processing ? 'Processing...' : `Charge ${formatCurrency(total, symbol)}`}
            </button>
          </div>
        )}
      </div>

      {/* Customer modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowCustomerModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">Select Customer</h3>
              <button onClick={() => setShowCustomerModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Search customers..."
                className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filteredCustomers.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-4">No customers found</p>
              ) : filteredCustomers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCustomer(c); setShowCustomerModal(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-left"
                >
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">
                    {c.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{c.name}</p>
                    <p className="text-xs text-slate-400">{c.email ?? 'No email'} · {c.loyalty_points} pts</p>
                  </div>
                  {selectedCustomer?.id === c.id && <Check className="w-4 h-4 text-emerald-500" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Receipt modal */}
      {showReceipt && lastSale && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowReceipt(false)}>
          <div className="bg-white rounded-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-2">
                <Check className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="font-bold text-slate-900">Sale Complete</h3>
              <p className="text-xs text-slate-400">{formatDateTime(lastSale.created_at)}</p>
            </div>
            <div className="border-t border-b border-dashed border-slate-200 py-3 my-3 text-sm space-y-1">
              <div className="flex justify-between font-bold mb-1">
                <span>{settings?.store_name ?? 'Bookstore'}</span>
              </div>
              <p className="text-xs text-slate-400">{settings?.address}</p>
              <p className="text-xs text-slate-400">{settings?.phone}</p>
              <p className="text-xs text-slate-400 mt-2">Receipt #{generateReceiptNumber(lastSale.id)}</p>
              {lastSale.customer && <p className="text-xs text-slate-400">Customer: {lastSale.customer.name}</p>}
            </div>
            <div className="space-y-1 text-sm">
              {lastSale.sale_items?.map((item: any) => (
                <div key={item.id} className="flex justify-between text-slate-600">
                  <span className="truncate flex-1">{item.quantity}× {item.book_title}</span>
                  <span>{formatCurrency(Number(item.line_total), symbol)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-dashed border-slate-200 mt-3 pt-3 space-y-1 text-sm">
              <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{formatCurrency(Number(lastSale.subtotal), symbol)}</span></div>
              {Number(lastSale.discount_amount) > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>-{formatCurrency(Number(lastSale.discount_amount), symbol)}</span></div>}
              <div className="flex justify-between text-slate-500"><span>Tax</span><span>{formatCurrency(Number(lastSale.tax_amount), symbol)}</span></div>
              <div className="flex justify-between font-bold text-slate-900 text-base pt-1"><span>Total</span><span>{formatCurrency(Number(lastSale.total), symbol)}</span></div>
              <div className="flex justify-between text-slate-500"><span>Paid ({lastSale.payment_method})</span><span>{formatCurrency(Number(lastSale.amount_paid), symbol)}</span></div>
              {Number(lastSale.change_amount) > 0 && <div className="flex justify-between text-slate-500"><span>Change</span><span>{formatCurrency(Number(lastSale.change_amount), symbol)}</span></div>}
            </div>
            <p className="text-center text-xs text-slate-400 mt-4">{settings?.receipt_footer}</p>
            <div className="flex gap-2 mt-5">
              <button onClick={() => window.print()} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2">
                <Printer className="w-4 h-4" /> Print
              </button>
              <button onClick={() => setShowReceipt(false)} className="flex-1 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

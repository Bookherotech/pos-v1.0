import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key',
);

export type Category = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export type Book = {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  category_id: string | null;
  price: number;
  cost: number;
  stock: number;
  low_stock_threshold: number;
  cover_url: string | null;
  description: string | null;
  publisher: string | null;
  published_year: number | null;
  created_at: string;
  updated_at: string;
  category?: Category | null;
};

export type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  loyalty_points: number;
  notes: string | null;
  created_at: string;
};

export type Sale = {
  id: string;
  customer_id: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  payment_method: string;
  amount_paid: number;
  change_amount: number;
  status: string;
  notes: string | null;
  created_at: string;
  customer?: Customer | null;
  sale_items?: SaleItem[];
};

export type SaleItem = {
  id: string;
  sale_id: string;
  book_id: string | null;
  book_title: string;
  isbn: string | null;
  price: number;
  quantity: number;
  line_total: number;
  created_at: string;
};

export type StockAdjustment = {
  id: string;
  book_id: string;
  old_stock: number;
  new_stock: number;
  adjustment: number;
  reason: string;
  created_at: string;
  book?: Book | null;
};

export type Settings = {
  id: string;
  store_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  tax_rate: number;
  currency_symbol: string;
  receipt_footer: string;
  low_stock_alert: boolean;
  loyalty_enabled: boolean;
  loyalty_rate: number;
  created_at: string;
};

export type CartItem = {
  book_id: string;
  title: string;
  author: string;
  isbn: string | null;
  price: number;
  quantity: number;
  stock: number;
};

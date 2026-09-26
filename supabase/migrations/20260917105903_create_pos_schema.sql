/*
# Bookstore POS Schema

Creates the complete database schema for a bookstore point-of-sale system.

1. New Tables
- `categories`: Book categories (Fiction, Non-Fiction, Children, etc.)
- `books`: Inventory items with title, author, ISBN, price, cost, stock quantity, category
- `customers`: Customer records with loyalty points
- `sales`: Completed transactions with totals, tax, discount, payment method
- `sale_items`: Line items for each sale
- `stock_adjustments`: Manual stock correction history with reason
- `settings`: Store configuration (name, address, tax rate, currency)

2. Security
- RLS enabled on every table.
- All tables allow anon + authenticated CRUD (single-tenant, no sign-in).
- USING (true) is acceptable because this is an intentionally shared single-tenant app.

3. Notes
- Sales record subtotal, tax_amount, discount_amount, total, and payment_method.
- Sale items snapshot the book title and price at time of sale for historical accuracy.
- Stock adjustments track manual corrections (damage, shrinkage, recounts).
- Settings is a single-row table for store configuration.
*/

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_categories" ON categories;
CREATE POLICY "anon_select_categories" ON categories FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_categories" ON categories;
CREATE POLICY "anon_insert_categories" ON categories FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_categories" ON categories;
CREATE POLICY "anon_update_categories" ON categories FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_categories" ON categories;
CREATE POLICY "anon_delete_categories" ON categories FOR DELETE TO anon, authenticated USING (true);

-- Books
CREATE TABLE IF NOT EXISTS books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text NOT NULL,
  isbn text UNIQUE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  price numeric(10,2) NOT NULL DEFAULT 0,
  cost numeric(10,2) NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  low_stock_threshold integer NOT NULL DEFAULT 5,
  cover_url text,
  description text,
  publisher text,
  published_year integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_books" ON books;
CREATE POLICY "anon_select_books" ON books FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_books" ON books;
CREATE POLICY "anon_insert_books" ON books FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_books" ON books;
CREATE POLICY "anon_update_books" ON books FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_books" ON books;
CREATE POLICY "anon_delete_books" ON books FOR DELETE TO anon, authenticated USING (true);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  address text,
  loyalty_points integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_customers" ON customers;
CREATE POLICY "anon_select_customers" ON customers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_customers" ON customers;
CREATE POLICY "anon_insert_customers" ON customers FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_customers" ON customers;
CREATE POLICY "anon_update_customers" ON customers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_customers" ON customers;
CREATE POLICY "anon_delete_customers" ON customers FOR DELETE TO anon, authenticated USING (true);

-- Sales
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  tax_amount numeric(10,2) NOT NULL DEFAULT 0,
  discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  amount_paid numeric(10,2) NOT NULL DEFAULT 0,
  change_amount numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_sales" ON sales;
CREATE POLICY "anon_select_sales" ON sales FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_sales" ON sales;
CREATE POLICY "anon_insert_sales" ON sales FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_sales" ON sales;
CREATE POLICY "anon_update_sales" ON sales FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_sales" ON sales;
CREATE POLICY "anon_delete_sales" ON sales FOR DELETE TO anon, authenticated USING (true);

-- Sale Items
CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  book_id uuid REFERENCES books(id) ON DELETE SET NULL,
  book_title text NOT NULL,
  isbn text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  line_total numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_sale_items" ON sale_items;
CREATE POLICY "anon_select_sale_items" ON sale_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_sale_items" ON sale_items;
CREATE POLICY "anon_insert_sale_items" ON sale_items FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_sale_items" ON sale_items;
CREATE POLICY "anon_update_sale_items" ON sale_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_sale_items" ON sale_items;
CREATE POLICY "anon_delete_sale_items" ON sale_items FOR DELETE TO anon, authenticated USING (true);

-- Stock Adjustments
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  old_stock integer NOT NULL,
  new_stock integer NOT NULL,
  adjustment integer NOT NULL,
  reason text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_stock_adjustments" ON stock_adjustments;
CREATE POLICY "anon_select_stock_adjustments" ON stock_adjustments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_stock_adjustments" ON stock_adjustments;
CREATE POLICY "anon_insert_stock_adjustments" ON stock_adjustments FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Settings (single-row config table)
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text NOT NULL DEFAULT 'Chapter One Bookstore',
  address text,
  phone text,
  email text,
  tax_rate numeric(5,2) NOT NULL DEFAULT 8.25,
  currency_symbol text NOT NULL DEFAULT '$',
  receipt_footer text DEFAULT 'Thank you for shopping with us!',
  low_stock_alert boolean NOT NULL DEFAULT true,
  loyalty_enabled boolean NOT NULL DEFAULT true,
  loyalty_rate numeric(5,2) NOT NULL DEFAULT 1.00,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_settings" ON settings;
CREATE POLICY "anon_select_settings" ON settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_settings" ON settings;
CREATE POLICY "anon_insert_settings" ON settings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_settings" ON settings;
CREATE POLICY "anon_update_settings" ON settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_books_category ON books(category_id);
CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);
CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_book ON sale_items(book_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_book ON stock_adjustments(book_id);

-- Insert default settings row
INSERT INTO settings (store_name, address, phone, email)
SELECT 'Chapter One Bookstore', '123 Main Street, Portland, OR 97201', '(503) 555-0142', 'hello@chapteronebooks.com'
WHERE NOT EXISTS (SELECT 1 FROM settings);

-- Insert default categories
INSERT INTO categories (name, description) VALUES
('Fiction', 'Fictional literature and novels'),
('Non-Fiction', 'Factual and educational books'),
('Children''s', 'Books for children and young readers'),
('Mystery & Thriller', 'Mystery, crime, and thriller novels'),
('Science Fiction', 'Sci-fi and fantasy novels'),
('Biography', 'Biographies and memoirs'),
('Poetry', 'Poetry collections and anthologies'),
('Self-Help', 'Self-improvement and personal development')
ON CONFLICT (name) DO NOTHING;

-- Insert sample books
INSERT INTO books (title, author, isbn, category_id, price, cost, stock, low_stock_threshold, publisher, published_year, description)
SELECT 'The Midnight Library', 'Matt Haig', '9780525559473', c.id, 18.99, 9.50, 24, 5, 'Canongate Books', 2020, 'Between life and death there is a library.'
FROM categories c WHERE c.name = 'Fiction'
ON CONFLICT (isbn) DO NOTHING;

INSERT INTO books (title, author, isbn, category_id, price, cost, stock, low_stock_threshold, publisher, published_year, description)
SELECT 'Where the Crawdads Sing', 'Delia Owens', '9780735219090', c.id, 16.99, 8.25, 18, 5, 'Putnam', 2018, 'A coming-of-age mystery set in the marshes of North Carolina.'
FROM categories c WHERE c.name = 'Fiction'
ON CONFLICT (isbn) DO NOTHING;

INSERT INTO books (title, author, isbn, category_id, price, cost, stock, low_stock_threshold, publisher, published_year, description)
SELECT 'Educated', 'Tara Westover', '9780399590504', c.id, 19.99, 10.00, 12, 5, 'Random House', 2018, 'A memoir about a woman who leaves her survivalist family and goes on to earn a PhD.'
FROM categories c WHERE c.name = 'Biography'
ON CONFLICT (isbn) DO NOTHING;

INSERT INTO books (title, author, isbn, category_id, price, cost, stock, low_stock_threshold, publisher, published_year, description)
SELECT 'The Silent Patient', 'Alex Michaelides', '9781250301697', c.id, 17.99, 8.75, 3, 5, 'Celadon Books', 2019, 'A psychological thriller about a woman who shoots her husband and never speaks again.'
FROM categories c WHERE c.name = 'Mystery & Thriller'
ON CONFLICT (isbn) DO NOTHING;

INSERT INTO books (title, author, isbn, category_id, price, cost, stock, low_stock_threshold, publisher, published_year, description)
SELECT 'Dune', 'Frank Herbert', '9780441013593', c.id, 22.99, 11.50, 30, 5, 'Ace Books', 1965, 'A stunning blend of adventure and mysticism, environmentalism and politics.'
FROM categories c WHERE c.name = 'Science Fiction'
ON CONFLICT (isbn) DO NOTHING;

INSERT INTO books (title, author, isbn, category_id, price, cost, stock, low_stock_threshold, publisher, published_year, description)
SELECT 'The Very Hungry Caterpillar', 'Eric Carle', '9780399226908', c.id, 9.99, 4.50, 50, 10, 'Philomel Books', 1969, 'A caterpillar eats his way through a wide variety of foods.'
FROM categories c WHERE c.name = 'Children''s'
ON CONFLICT (isbn) DO NOTHING;

INSERT INTO books (title, author, isbn, category_id, price, cost, stock, low_stock_threshold, publisher, published_year, description)
SELECT 'Milk and Honey', 'Rupi Kaur', '9781449479639', c.id, 14.99, 7.00, 15, 5, 'Andrews McMeel', 2015, 'A collection of poetry and prose about survival, violence, abuse, love, and loss.'
FROM categories c WHERE c.name = 'Poetry'
ON CONFLICT (isbn) DO NOTHING;

INSERT INTO books (title, author, isbn, category_id, price, cost, stock, low_stock_threshold, publisher, published_year, description)
SELECT 'Atomic Habits', 'James Clear', '9780735211292', c.id, 27.00, 13.50, 40, 8, 'Avery', 2018, 'An easy and proven way to build good habits and break bad ones.'
FROM categories c WHERE c.name = 'Self-Help'
ON CONFLICT (isbn) DO NOTHING;

INSERT INTO books (title, author, isbn, category_id, price, cost, stock, low_stock_threshold, publisher, published_year, description)
SELECT 'Sapiens', 'Yuval Noah Harari', '9780062316097', c.id, 24.99, 12.00, 20, 5, 'Harper', 2015, 'A brief history of humankind.'
FROM categories c WHERE c.name = 'Non-Fiction'
ON CONFLICT (isbn) DO NOTHING;

INSERT INTO books (title, author, isbn, category_id, price, cost, stock, low_stock_threshold, publisher, published_year, description)
SELECT 'The Hobbit', 'J.R.R. Tolkien', '9780547928227', c.id, 14.99, 7.25, 35, 5, 'Houghton Mifflin', 1937, 'A fantasy novel about the quest of home-loving hobbit Bilbo Baggins.'
FROM categories c WHERE c.name = 'Science Fiction'
ON CONFLICT (isbn) DO NOTHING;

-- Insert sample customers
INSERT INTO customers (name, email, phone, loyalty_points)
VALUES
('Sarah Johnson', 'sarah.j@email.com', '(503) 555-0190', 120),
('Michael Chen', 'm.chen@email.com', '(503) 555-0191', 85),
('Emily Davis', 'emily.d@email.com', '(503) 555-0192', 240)
ON CONFLICT DO NOTHING;

-- Insert a sample sale
INSERT INTO sales (customer_id, subtotal, tax_amount, discount_amount, total, payment_method, amount_paid, change_amount, status)
SELECT (SELECT id FROM customers WHERE email = 'sarah.j@email.com'), 35.98, 2.97, 0, 38.95, 'card', 38.95, 0, 'completed'
WHERE NOT EXISTS (SELECT 1 FROM sales);

-- Insert sale items for the sample sale
INSERT INTO sale_items (sale_id, book_id, book_title, isbn, price, quantity, line_total)
SELECT s.id, b.id, b.title, b.isbn, b.price, 1, b.price
FROM sales s, books b
WHERE b.isbn = '9780525559473' AND NOT EXISTS (SELECT 1 FROM sale_items);

INSERT INTO sale_items (sale_id, book_id, book_title, isbn, price, quantity, line_total)
SELECT s.id, b.id, b.title, b.isbn, b.price, 1, b.price
FROM sales s, books b
WHERE b.isbn = '9780735219090' AND NOT EXISTS (SELECT 1 FROM sale_items WHERE book_id = (SELECT id FROM books WHERE isbn = '9780735219090'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS books_updated_at ON books;
CREATE TRIGGER books_updated_at BEFORE UPDATE ON books
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
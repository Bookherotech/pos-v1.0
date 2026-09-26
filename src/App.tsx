import { useEffect, useState } from 'react';
import { LayoutDashboard, ShoppingCart, Package, Receipt, Users, BarChart3, Settings as SettingsIcon, BookOpen } from 'lucide-react';
import { AppProvider } from '@/context/AppContext';
import { useSettings } from '@/hooks/useSettings';
import Dashboard from '@/pages/Dashboard';
import POS from '@/pages/POS';
import Inventory from '@/pages/Inventory';
import Sales from '@/pages/Sales';
import Customers from '@/pages/Customers';
import Reports from '@/pages/Reports';
import SettingsPage from '@/pages/Settings';

type Page = 'dashboard' | 'pos' | 'inventory' | 'sales' | 'customers' | 'reports' | 'settings';

const navItems: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'pos', label: 'Point of Sale', icon: ShoppingCart },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'sales', label: 'Sales History', icon: Receipt },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

function getPageFromHash(): Page {
  const value = window.location.hash.replace('#/', '') as Page;
  return navItems.some((item) => item.id === value) ? value : 'dashboard';
}

function AppContent() {
  const [page, setPage] = useState<Page>(() => {
    if (typeof window === 'undefined') return 'dashboard';
    return getPageFromHash();
  });
  const { settings, reload: reloadSettings } = useSettings();

  const navigate = (nextPage: Page) => {
    setPage(nextPage);
    window.history.replaceState(null, '', `#/${nextPage}`);
  };

  useEffect(() => {
    const handleHashChange = () => setPage(getPageFromHash());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard onNavigate={navigate} />;
      case 'pos': return <POS />;
      case 'inventory': return <Inventory />;
      case 'sales': return <Sales />;
      case 'customers': return <Customers />;
      case 'reports': return <Reports />;
      case 'settings': return <SettingsPage />;
    }
  };

  return (
    <AppProvider value={{ settings, reloadSettings, settingsLoading: false }}>
      <div className="flex h-screen bg-slate-50">
        {/* Sidebar */}
        <aside className="w-64 bg-slate-900 flex flex-col flex-shrink-0">
          <div className="px-6 py-5 flex items-center gap-3 border-b border-slate-800">
            <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-5 h-5 text-slate-900" />
            </div>
            <div className="min-w-0">
              <h1 className="text-white font-bold text-sm truncate">
                {settings?.store_name ?? 'Bookstore POS'}
              </h1>
              <p className="text-slate-400 text-xs">Point of Sale</p>
            </div>
          </div>
          <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = page === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-amber-500 text-slate-900'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="px-6 py-4 border-t border-slate-800">
            <p className="text-slate-500 text-xs">© 2026 Bookstore POS</p>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          {renderPage()}
        </main>
      </div>
    </AppProvider>
  );
}

export default function App() {
  return <AppContent />;
}

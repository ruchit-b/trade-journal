import { useState, useEffect } from 'react';
import { Sidebar, getSidebarCollapsed, setSidebarCollapsed } from './Sidebar';
import { useTheme } from '@/contexts/ThemeContext';
import { Moon, Sun } from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsedState] = useState(() => getSidebarCollapsed());

  useEffect(() => {
    setSidebarCollapsed(collapsed);
  }, [collapsed]);

  return (
    <div className="flex min-h-screen bg-base">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsedState((c) => !c)} />
      <main
        className={`flex min-h-screen flex-1 flex-col transition-[margin-left] duration-200 ease-in-out pb-20 md:pb-0 ${collapsed ? 'md:ml-16' : 'md:ml-[220px]'}`}
      >
        {children}
      </main>
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  return (
    <header className="sticky top-0 z-30 flex shrink-0 items-center justify-between gap-4 border-b border-border bg-base/95 backdrop-blur px-6 py-4">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold text-text-primary truncate">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-text-secondary truncate">{subtitle}</p>}
      </div>
      <div className="shrink-0 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleTheme}
          className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary hover:bg-elevated transition-colors"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>
        {actions && <div>{actions}</div>}
      </div>
    </header>
  );
}

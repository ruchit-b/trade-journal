import { useState, useEffect } from 'react';
import { Sidebar, getSidebarCollapsed, setSidebarCollapsed } from './Sidebar';

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
  return (
    <header className="sticky top-0 z-30 flex shrink-0 items-center justify-between gap-4 border-b border-border bg-base/95 backdrop-blur px-6 py-4">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold text-text-primary truncate">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-text-secondary truncate">{subtitle}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  );
}

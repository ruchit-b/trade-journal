import { NavLink, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  ListOrdered,
  PlusCircle,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { CandlestickLogo } from '@/components/icons/CandlestickLogo';

const SIDEBAR_COLLAPSED_KEY = 'sidebar_collapsed';

const NAV_ITEMS: { to: string; icon: LucideIcon; label: string }[] = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/trades', icon: ListOrdered, label: 'Trade Log' },
  { to: '/trades/new', icon: PlusCircle, label: 'Add Trade' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const width = collapsed ? 64 : 220;

  const initials = user?.name
    ?.split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?';

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <>
    <aside
      className="fixed left-0 top-0 z-40 hidden h-screen flex-col bg-base border-r border-border transition-[width] duration-200 ease-in-out md:flex"
      style={{ width }}
    >
      {/* Logo + brand */}
      <div className="flex h-14 shrink-0 items-center border-b border-border px-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center text-accent">
            <CandlestickLogo className="h-5 w-5" />
          </div>
          {!collapsed && (
            <span className="font-mono text-sm font-medium tracking-wide text-text-primary truncate">
              TradeEdge
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-elevated hover:text-text-primary transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/dashboard' || to === '/trades'}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 rounded-md py-2.5 text-sm font-medium transition-colors duration-150
                    ${collapsed ? 'justify-center px-0' : 'px-3'}
                    ${isActive
                      ? 'bg-elevated text-accent border-l-[3px] border-accent'
                      : 'text-text-secondary hover:bg-elevated/80 hover:text-text-primary border-l-[3px] border-transparent'
                    }`
                }
              >
                {() => (
                  <>
                    <Icon className="shrink-0" size={20} />
                    {!collapsed && <span className="truncate">{label}</span>}
                    {collapsed && (
                      <span
                        className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-elevated px-2 py-1.5 text-xs text-text-primary shadow-lg border border-border opacity-0 transition-opacity group-hover:opacity-100"
                        role="tooltip"
                      >
                        {label}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* User + logout */}
      <div className="shrink-0 border-t border-border p-2">
        <div className={`flex items-center gap-3 rounded-md px-2 py-2 ${collapsed ? 'flex-col gap-2' : ''}`}>
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-dim text-accent font-mono text-sm font-medium"
            title={user?.email}
          >
            {initials}
          </div>
          {collapsed ? (
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-elevated hover:text-loss transition-colors"
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          ) : (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-text-secondary">{user?.email}</p>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-0.5 flex items-center gap-1.5 text-xs text-text-muted hover:text-loss transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>

    {/* Mobile: bottom tab bar */}
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-base py-2 md:hidden">
      {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/dashboard'}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 rounded-md px-3 py-2 text-xs font-medium transition-colors min-w-0 flex-1
              ${isActive ? 'text-accent' : 'text-text-muted'}`
          }
        >
          <Icon className="h-5 w-5 shrink-0" />
          <span className="truncate w-full text-center">{label}</span>
        </NavLink>
      ))}
    </nav>
    </>
  );
}

export function getSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
}

export function setSidebarCollapsed(collapsed: boolean): void {
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
}

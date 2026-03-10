import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { CandlestickLogo } from '@/components/icons/CandlestickLogo';
import { ChevronRight, ClipboardCheck, ScanSearch, ShieldCheck } from 'lucide-react';

function FeatureRow({
  icon,
  iconClassName = '',
  iconWrapClassName = '',
  title,
  description,
}: {
  icon: React.ReactNode;
  iconClassName?: string;
  iconWrapClassName?: string;
  title: string;
  description: string;
}) {
  return (
    <div className="py-4">
      <div className="flex items-start gap-5">
        <div className="relative mt-0.5 shrink-0">
          <div className={`relative flex h-9 w-9 items-center justify-center rounded-xl border border-border ${iconWrapClassName}`}>
            <span className={iconClassName}>{icon}</span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-text-primary">{title}</p>
          <p className="mt-1.5 text-[13px] text-text-secondary leading-snug max-w-[62ch]">{description}</p>
        </div>
      </div>
    </div>
  );
}

function PreviewCard() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,var(--accent-dim),transparent_40%),radial-gradient(circle_at_80%_30%,rgba(239,68,68,0.10),transparent_45%)]" />
      <div className="relative p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-text-muted tracking-wide">TRADE LOG (PREVIEW)</p>
            <p className="mt-1 text-sm font-semibold text-text-primary">Clean, filterable, fast</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-border bg-elevated px-3 py-1 text-xs font-medium text-text-secondary">
              Reward:Risk <span className="ml-2 font-mono text-text-primary">2.1</span>
            </span>
            <span className="inline-flex items-center rounded-full border border-border bg-elevated px-3 py-1 text-xs font-medium text-text-secondary">
              P&L <span className="ml-2 font-mono text-profit">+₹4,820</span>
            </span>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-border bg-elevated/40">
          <div className="grid grid-cols-4 gap-2 border-b border-border px-4 py-3 text-[11px] font-medium text-text-muted">
            <span>Symbol</span>
            <span className="text-right">Dir</span>
            <span className="text-right">Entry</span>
            <span className="text-right">P&L</span>
          </div>
          {[
            { s: 'RELIANCE', d: 'Long', e: '2,815.20', p: '+1,240', pos: true },
            { s: 'TCS', d: 'Short', e: '4,112.75', p: '+3,580', pos: true },
            { s: 'INFY', d: 'Long', e: '1,487.10', p: '—', pos: null },
          ].map((r) => (
            <div
              key={r.s}
              className="grid grid-cols-4 gap-2 px-4 py-3 text-sm text-text-primary border-b border-border-subtle last:border-b-0"
            >
              <span className="font-mono font-semibold">{r.s}</span>
              <span className={`text-right font-mono ${r.d === 'Long' ? 'text-profit' : 'text-loss'}`}>{r.d}</span>
              <span className="text-right font-mono text-text-secondary">{r.e}</span>
              <span
                className={`text-right font-mono ${
                  r.pos === true ? 'text-profit' : r.pos === false ? 'text-loss' : 'text-text-muted'
                }`}
              >
                {r.p}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-elevated/50 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs text-text-muted">Add a trade in seconds</p>
            <p className="mt-0.5 text-sm font-semibold text-text-primary">Capture → review → improve</p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
            See details <ChevronRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div
      className="min-h-screen bg-base"
      style={{
        backgroundImage: `
          repeating-linear-gradient(0deg, transparent, transparent 34px, color-mix(in oklab, var(--accent) 8%, transparent) 34px, color-mix(in oklab, var(--accent) 8%, transparent) 35px),
          repeating-linear-gradient(90deg, transparent, transparent 34px, color-mix(in oklab, var(--accent) 8%, transparent) 34px, color-mix(in oklab, var(--accent) 8%, transparent) 35px)
        `,
      }}
    >
      <header className="sticky top-0 z-20 border-b border-border bg-base/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center text-accent">
              <CandlestickLogo className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-mono text-sm font-semibold tracking-wide text-text-primary truncate">TradeEdge</p>
              <p className="text-xs text-text-muted truncate">Swing trade journal</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-20 pt-16 sm:pt-20">
        {/* Hero */}
        <section className="mx-auto max-w-3xl text-center">
          <h1 className="text-5xl font-semibold tracking-tight text-text-primary sm:text-6xl">
            Your edge isn’t a feeling. It’s a dataset.
          </h1>
          <p className="mt-5 text-lg text-text-secondary sm:text-xl">
            TradeEdge helps you capture trades cleanly and surface patterns fast — with risk, outcomes, and consistency always in view.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/register">
              <Button variant="primary" size="lg">
                Start journaling
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="secondary" size="lg">
                Log in
              </Button>
            </Link>
          </div>
        </section>

        {/* Features + preview */}
        <section className="mt-20 sm:mt-24 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-start">
          <div className="rounded-2xl border border-border bg-surface/60 backdrop-blur px-6 py-1 lg:max-h-[560px] lg:overflow-hidden">
            <FeatureRow
              icon={<ClipboardCheck className="h-4 w-4" />}
              iconWrapClassName="bg-emerald-500/15 border-emerald-400/40"
              iconClassName="text-emerald-300"
              title="Turn every trade into a clean record."
              description="Direction, dates, entry/exit, SL/target — captured in a consistent structure so your future self can trust the data."
            />
            <div className="h-px w-full bg-border-subtle/70" />
            <FeatureRow
              icon={<ScanSearch className="h-4 w-4" />}
              iconWrapClassName="bg-cyan-500/15 border-cyan-400/40"
              iconClassName="text-cyan-300"
              title="Replay your month in 30 seconds."
              description="Filter, sort, and scan outcomes fast. When something works, you’ll know exactly what to repeat — and what to stop doing."
            />
            <div className="h-px w-full bg-border-subtle/70" />
            <FeatureRow
              icon={<ShieldCheck className="h-4 w-4" />}
              iconWrapClassName="bg-amber-500/15 border-amber-400/40"
              iconClassName="text-amber-300"
              title="Keep risk honest, by default."
              description="Reward:Risk and portfolio impact stay visible while logging and reviewing — so you don’t accidentally optimize the wrong thing."
            />
          </div>

          <div className="lg:pl-6">
            <PreviewCard />
          </div>
        </section>

        <footer className="mt-20 border-t border-border pt-8 text-xs text-text-muted">
          <span>© {new Date().getFullYear()} TradeEdge</span>
        </footer>
      </main>
    </div>
  );
}


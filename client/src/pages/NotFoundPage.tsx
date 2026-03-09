import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { LayoutDashboard } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-base p-6">
      <p className="font-mono text-6xl sm:text-8xl font-semibold text-text-primary tabular-nums">404</p>
      <p className="mt-4 text-lg text-text-secondary">This page doesn&apos;t exist</p>
      <Link to="/dashboard" className="mt-6">
        <Button variant="primary" size="lg" leftIcon={<LayoutDashboard className="h-5 w-5" />}>
          Back to Dashboard
        </Button>
      </Link>
    </div>
  );
}

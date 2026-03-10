import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const {
    register: registerField,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(data: FormData) {
    try {
      await login(data.email, data.password);
      toast.success('Welcome back.');
      navigate('/dashboard');
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : 'Sign in failed. Try again.';
      toast.error(message ?? 'Sign in failed.');
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-base"
      style={{
        backgroundImage: `
          repeating-linear-gradient(0deg, transparent, transparent 31px, rgba(0,200,150,0.03) 31px, rgba(0,200,150,0.03) 32px),
          repeating-linear-gradient(90deg, transparent, transparent 31px, rgba(0,200,150,0.03) 31px, rgba(0,200,150,0.03) 32px)
        `,
      }}
    >
      <div className="w-full max-w-[400px]">
        <div className="bg-surface border border-border rounded-lg p-8 shadow-xl">
          <div className="text-center mb-8">
            <div className="font-mono text-accent text-sm tracking-widest mb-1">TRADEEDGE</div>
            <h1 className="font-sans text-text-primary text-xl font-semibold mt-2">
              Welcome back, trader.
            </h1>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="w-full px-4 py-3 bg-elevated border border-border rounded-md text-text-primary placeholder-text-muted
                  focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all duration-200"
                placeholder="you@example.com"
                {...registerField('email')}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-loss">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="w-full px-4 py-3 bg-elevated border border-border rounded-md text-text-primary placeholder-text-muted
                  focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all duration-200"
                placeholder="••••••••"
                {...registerField('password')}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-loss">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-accent text-base font-semibold text-accent-foreground rounded-md hover:bg-accent/90
                focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface
                disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            No account?{' '}
            <Link to="/register" className="text-accent hover:underline font-medium">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

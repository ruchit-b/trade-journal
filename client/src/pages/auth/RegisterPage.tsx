import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const schema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
    email: z.string().min(1, 'Email is required').email('Valid email is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

export function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const {
    register: registerField,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  async function onSubmit(data: FormData) {
    try {
      await registerUser(data.email, data.password, data.name);
      toast.success('Account created.');
      navigate('/dashboard');
    } catch (err: unknown) {
      const res = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data
        : null;
      const message = res?.error ?? 'Registration failed. Try again.';
      toast.error(message);
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
              Create your account
            </h1>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-text-secondary mb-1.5">
                Name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                className="w-full px-4 py-3 bg-elevated border border-border rounded-md text-text-primary placeholder-text-muted
                  focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all duration-200"
                placeholder="Your name"
                {...registerField('name')}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-loss">{errors.name.message}</p>
              )}
            </div>

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
                autoComplete="new-password"
                className="w-full px-4 py-3 bg-elevated border border-border rounded-md text-text-primary placeholder-text-muted
                  focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all duration-200"
                placeholder="At least 8 characters"
                {...registerField('password')}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-loss">{errors.password.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-secondary mb-1.5">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                className="w-full px-4 py-3 bg-elevated border border-border rounded-md text-text-primary placeholder-text-muted
                  focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all duration-200"
                placeholder="••••••••"
                {...registerField('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-loss">{errors.confirmPassword.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-accent text-base font-semibold text-[#0a0a0f] rounded-md hover:bg-accent/90
                focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface
                disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating account…
                </>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            Already have an account?{' '}
            <Link to="/login" className="text-accent hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

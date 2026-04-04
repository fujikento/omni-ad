'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { I18nProvider, useI18n } from '@/lib/i18n';

interface RegisterErrorResponse {
  message?: string;
}

interface AuthSuccessPayload {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string };
}

interface TRPCSuccessResponse {
  result?: { data?: { json?: AuthSuccessPayload } };
}

export default function RegisterPage(): React.ReactElement {
  return (
    <I18nProvider>
      <RegisterForm />
    </I18nProvider>
  );
}

function RegisterForm(): React.ReactElement {
  const { t } = useI18n();
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [organizationName, setOrganizationName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || password.length < 8 || password !== confirmPassword || !organizationName.trim()) {
      setError(t('auth.registerError'));
      return;
    }

    setIsLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/trpc';
      const registerResponse = await fetch(`${apiUrl}/auth.register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: { name, email, password, organizationName },
        }),
      });

      if (!registerResponse.ok) {
        const body: unknown = await registerResponse.json().catch(() => null);
        const parsed = body as { error?: { json?: RegisterErrorResponse } } | null;
        const message = parsed?.error?.json?.message ?? t('auth.registerError');
        setError(message);
        return;
      }

      // Auto-login after registration
      const loginResponse = await fetch(`${apiUrl}/auth.login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: { email, password } }),
      });

      if (loginResponse.ok) {
        const data: unknown = await loginResponse.json();
        const result = data as TRPCSuccessResponse;
        const payload = result?.result?.data?.json;
        const accessToken = payload?.accessToken;
        const refreshToken = payload?.refreshToken;

        if (accessToken) {
          localStorage.setItem('omni-ad-token', accessToken);
        }
        if (refreshToken) {
          localStorage.setItem('omni-ad-refresh-token', refreshToken);
        }
      }

      window.location.href = '/onboarding';
    } catch {
      setError(t('auth.networkError'));
    } finally {
      setIsLoading(false);
    }
  }

  const inputCls =
    'mt-1.5 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20';

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            OMNI-AD
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('auth.registerSubtitle')}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-border bg-card p-8 shadow-sm"
        >
          <div className="space-y-4">
            <div>
              <label
                htmlFor="register-name"
                className="block text-sm font-medium text-foreground"
              >
                {t('auth.name')}
              </label>
              <input
                id="register-name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setName(e.target.value)
                }
                className={inputCls}
                placeholder="John Doe"
              />
            </div>

            <div>
              <label
                htmlFor="register-email"
                className="block text-sm font-medium text-foreground"
              >
                {t('auth.email')}
              </label>
              <input
                id="register-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEmail(e.target.value)
                }
                className={inputCls}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="register-password"
                className="block text-sm font-medium text-foreground"
              >
                {t('auth.password')}
              </label>
              <input
                id="register-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setPassword(e.target.value)
                }
                className={inputCls}
                placeholder={t('auth.passwordPlaceholder')}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {t('auth.passwordMinLength')}
              </p>
            </div>

            <div>
              <label
                htmlFor="register-confirm-password"
                className="block text-sm font-medium text-foreground"
              >
                {t('auth.confirmPassword')}
              </label>
              <input
                id="register-confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setConfirmPassword(e.target.value)
                }
                className={inputCls}
                placeholder={t('auth.reenterPassword')}
              />
            </div>

            <div>
              <label
                htmlFor="register-org"
                className="block text-sm font-medium text-foreground"
              >
                {t('auth.orgName')}
              </label>
              <input
                id="register-org"
                name="organizationName"
                type="text"
                autoComplete="organization"
                required
                value={organizationName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setOrganizationName(e.target.value)
                }
                className={inputCls}
                placeholder="Acme Inc."
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
            >
              {isLoading && <Loader2 size={16} className="animate-spin" />}
              {t('auth.createAccount')}
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t('auth.hasAccount')}{' '}
            <a
              href="/login"
              className="font-medium text-primary hover:underline"
            >
              {t('auth.login')}
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}

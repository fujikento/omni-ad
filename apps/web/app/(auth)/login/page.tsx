'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface LoginErrorResponse {
  message?: string;
}

export default function LoginPage(): React.ReactElement {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3001/trpc/auth.login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: { email, password } }),
      });

      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const parsed = body as { error?: { json?: LoginErrorResponse } } | null;
        const message =
          parsed?.error?.json?.message ?? 'ログインに失敗しました。メールアドレスとパスワードを確認してください。';
        setError(message);
        return;
      }

      const data: unknown = await response.json();
      const result = data as { result?: { data?: { json?: { token?: string } } } };
      const token = result?.result?.data?.json?.token;

      if (token) {
        localStorage.setItem('omni-ad-token', token);
      }

      window.location.href = '/home';
    } catch {
      setError('サーバーに接続できませんでした。しばらくしてからもう一度お試しください。');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            OMNI-AD
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            統合マーケティング自動化プラットフォーム
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-border bg-card p-8 shadow-sm"
        >
          <div className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground"
              >
                メールアドレス
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEmail(e.target.value)
                }
                className="mt-1.5 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-foreground"
              >
                パスワード
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setPassword(e.target.value)
                }
                className="mt-1.5 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
                placeholder="********"
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
              ログイン
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            アカウントをお持ちでないですか？{' '}
            <a
              href="/register"
              className="font-medium text-primary hover:underline"
            >
              新規登録
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}

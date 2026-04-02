'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

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
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [organizationName, setOrganizationName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  function validate(): string | null {
    if (!name.trim()) return '名前を入力してください。';
    if (!email.trim()) return 'メールアドレスを入力してください。';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '有効なメールアドレスを入力してください。';
    if (password.length < 8) return 'パスワードは8文字以上で入力してください。';
    if (password !== confirmPassword) return 'パスワードが一致しません。';
    if (!organizationName.trim()) return '組織名を入力してください。';
    return null;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);

    try {
      // Register
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
        const message =
          parsed?.error?.json?.message ?? '登録に失敗しました。入力内容を確認してください。';
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
      setError('サーバーに接続できませんでした。しばらくしてからもう一度お試しください。');
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
            新規アカウント登録
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
                名前
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
                placeholder="田中 太郎"
              />
            </div>

            <div>
              <label
                htmlFor="register-email"
                className="block text-sm font-medium text-foreground"
              >
                メールアドレス
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
                パスワード
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
                placeholder="8文字以上"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                8文字以上で入力してください
              </p>
            </div>

            <div>
              <label
                htmlFor="register-confirm-password"
                className="block text-sm font-medium text-foreground"
              >
                パスワード（確認）
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
                placeholder="パスワードを再入力"
              />
            </div>

            <div>
              <label
                htmlFor="register-org"
                className="block text-sm font-medium text-foreground"
              >
                組織名
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
                placeholder="株式会社サンプル"
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
              アカウント作成
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            既にアカウントをお持ちですか？{' '}
            <a
              href="/login"
              className="font-medium text-primary hover:underline"
            >
              ログイン
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}

'use client';

import { LayoutDashboard } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export default function DashboardPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t('dashboard.title')}
        </h1>
      </div>
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-card p-16 text-center">
        <LayoutDashboard size={48} className="text-muted-foreground/30" />
        <div>
          <p className="text-lg font-medium text-foreground">
            {t('dashboard.welcomeTitle')}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('dashboard.welcomeDescription')}
          </p>
        </div>
        <a
          href="/settings"
          className="mt-2 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t('dashboard.connectPlatform')}
        </a>
      </div>
    </div>
  );
}

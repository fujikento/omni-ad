'use client';

import Link from 'next/link';
import { Building2, Inbox } from 'lucide-react';
import { PageHeader } from '@omni-ad/ui';
import { useI18n } from '@/lib/i18n';

// ============================================================
// Main Page
// ============================================================

export default function ClientsPage(): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Management"
        title={t('clients.title')}
        description={t('clients.description')}
      />

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
        <div className="flex items-center gap-2 border-b border-border px-6 py-4">
          <Building2 size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-foreground">{t('clients.clientList')}</h2>
        </div>
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <Inbox size={28} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            クライアントデータがありません。設定から組織を追加してください。
          </p>
          <Link
            href="/settings"
            className="mt-2 inline-flex items-center rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t('nav.settings')}
          </Link>
        </div>
      </div>
    </div>
  );
}

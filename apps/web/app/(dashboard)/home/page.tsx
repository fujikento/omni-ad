'use client';

import dynamic from 'next/dynamic';

const DashboardClient = dynamic(() => import('./dashboard-client').then(m => ({ default: m.DashboardClient })), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center p-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  ),
});

export default function DashboardPage() {
  return <DashboardClient />;
}

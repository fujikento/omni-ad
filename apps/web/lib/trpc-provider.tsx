'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import { trpc } from './trpc';

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        retry: 1,
      },
    },
  });
}

interface TRPCProviderProps {
  children: React.ReactNode;
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/trpc';

export function TRPCProvider({ children }: TRPCProviderProps): React.ReactElement {
  const [queryClient] = useState(makeQueryClient);
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: apiUrl,
          transformer: superjson,
          headers(): Record<string, string> {
            const token = typeof window !== 'undefined'
              ? localStorage.getItem('omni-ad-token')
              : null;
            return token ? { authorization: `Bearer ${token}` } : {};
          },
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}

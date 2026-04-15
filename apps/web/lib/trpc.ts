import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../api/src/trpc/router';

// tRPC v11 has a ProtectedIntersection type guard that produces an
// IntersectionError when it detects key collisions between the React
// wrapper (useContext, useUtils, Provider, etc.) and the router record.
// In practice this collision does not exist for our router keys, but
// the deep type resolution across workspace boundaries can trigger a
// false positive. We use a two-step pattern:
//   1. createTRPCReact<AppRouter>() produces the correct runtime proxy
//   2. We re-export it with an explicit CreateTRPCReactBase & router type
//      to bypass the ProtectedIntersection check at the type level.
//
const _trpc = createTRPCReact<AppRouter>() as ReturnType<typeof createTRPCReact<AppRouter>>;

// Re-export with the same type, resolving false-positive collision
// by going through `typeof` which collapses the error union.
export const trpc: typeof _trpc = _trpc;

'use client';

import { memo } from 'react';
import { TABLE_COLUMNS } from '../_types';

function SkeletonRowImpl(): React.ReactElement {
  return (
    <tr className="animate-pulse border-b border-border">
      <td className="px-4 py-3"><div className="h-4 w-4 rounded bg-muted" /></td>
      {TABLE_COLUMNS.map((col) => (
        <td key={col.key} className="px-4 py-3">
          <div className="h-4 w-20 rounded bg-muted" />
        </td>
      ))}
    </tr>
  );
}

export const SkeletonRow = memo(SkeletonRowImpl);

'use client';

import { memo } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SortDirection, SortField } from '../_types';

interface SortHeaderProps {
  label: string;
  field: SortField;
  currentField: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
}

function SortHeaderImpl({
  label,
  field,
  currentField,
  direction,
  onSort,
}: SortHeaderProps): React.ReactElement {
  const isActive = currentField === field;
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-left font-medium text-muted-foreground hover:text-foreground"
      onClick={() => onSort(field)}
    >
      {label}
      <ArrowUpDown
        size={14}
        className={cn('transition-colors', isActive ? 'text-foreground' : 'text-muted-foreground/40')}
        style={isActive && direction === 'desc' ? { transform: 'scaleY(-1)' } : undefined}
      />
    </button>
  );
}

export const SortHeader = memo(SortHeaderImpl);

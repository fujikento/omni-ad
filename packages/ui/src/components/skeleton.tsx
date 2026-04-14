import { type HTMLAttributes } from 'react';
import { cn } from '../utils.js';

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

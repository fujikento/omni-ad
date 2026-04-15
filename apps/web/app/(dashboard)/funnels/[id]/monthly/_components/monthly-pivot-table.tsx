'use client';

import { memo, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { StageCell } from './stage-cell';
import { NoteCell } from './note-cell';
import { buildColumns, trailingFor, type ColumnDef } from '../_utils';
import type { MonthlyRow, PivotMeta } from '../_types';

export interface MonthlyPivotTableProps {
  months: MonthlyRow[];
  meta: PivotMeta;
  notes: Record<string, string>;
  savingMonth: string | null;
  onNoteSave: (month: string, text: string) => void;
}

interface RowProps {
  row: MonthlyRow;
  index: number;
  rows: MonthlyRow[];
  columns: ColumnDef[];
  note: string;
  saving: boolean;
  onNoteSave: (month: string, text: string) => void;
}

function MonthRowImpl({
  row,
  index,
  rows,
  columns,
  note,
  saving,
  onNoteSave,
}: RowProps): React.ReactElement {
  return (
    <tr className="border-b border-border hover:bg-muted/30">
      <th
        scope="row"
        className="sticky left-0 z-10 whitespace-nowrap border-r border-border bg-card px-3 py-2 text-left text-xs font-semibold text-foreground"
      >
        {row.month}
      </th>
      {columns.map((col) => {
        const t = trailingFor(rows, index, col.key);
        return (
          <td key={col.key} className="whitespace-nowrap px-3 py-2 text-xs">
            <StageCell
              formatted={col.format(row[col.key])}
              trailing={t.series}
              anomalyZ={t.anomalyZ}
            />
          </td>
        );
      })}
      <td className="whitespace-nowrap px-3 py-2 text-xs">
        <NoteCell
          month={row.month}
          initialText={note}
          onSave={onNoteSave}
          saving={saving}
        />
      </td>
    </tr>
  );
}

const MonthRow = memo(MonthRowImpl);
MonthRow.displayName = 'MonthRow';

function MonthlyPivotTableImpl({
  months,
  meta,
  notes,
  savingMonth,
  onNoteSave,
}: MonthlyPivotTableProps): React.ReactElement {
  const columns = useMemo(() => buildColumns(meta), [meta]);
  const handleNoteSave = useCallback(
    (month: string, text: string) => onNoteSave(month, text),
    [onNoteSave],
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th
              scope="col"
              className={cn(
                'sticky left-0 z-20 border-r border-border bg-muted/40 px-3 py-2 text-left text-xs font-semibold text-muted-foreground',
              )}
            >
              月
            </th>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold text-muted-foreground"
              >
                {col.header}
              </th>
            ))}
            <th
              scope="col"
              className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-muted-foreground"
            >
              備考
            </th>
          </tr>
        </thead>
        <tbody>
          {months.map((row, i) => (
            <MonthRow
              key={row.month}
              row={row}
              index={i}
              rows={months}
              columns={columns}
              note={notes[row.month] ?? ''}
              saving={savingMonth === row.month}
              onNoteSave={handleNoteSave}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const MonthlyPivotTable = memo(MonthlyPivotTableImpl);
MonthlyPivotTable.displayName = 'MonthlyPivotTable';

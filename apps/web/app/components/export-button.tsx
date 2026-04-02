'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

// -- Types --

interface ColumnDefinition<T> {
  key: keyof T;
  label: string;
  format?: (value: T[keyof T], row: T) => string;
}

interface ExportButtonProps<T> {
  data: T[];
  columns: ColumnDefinition<T>[];
  filename?: string;
  className?: string;
}

type ExportFormat = 'csv' | 'xlsx';

// -- Helpers --

function escapeCSVValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function convertToCSV<T>(data: T[], columns: ColumnDefinition<T>[]): string {
  const header = columns.map((col) => escapeCSVValue(col.label)).join(',');
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const rawValue = row[col.key];
        const formatted = col.format
          ? col.format(rawValue, row)
          : String(rawValue ?? '');
        return escapeCSVValue(formatted);
      })
      .join(','),
  );
  // BOM for Excel compatibility with Japanese characters
  return '\uFEFF' + [header, ...rows].join('\n');
}

function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// -- Component --

export function ExportButton<T>({
  data,
  columns,
  filename = 'export',
  className,
}: ExportButtonProps<T>): React.ReactElement {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return undefined;

    function handleClickOutside(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  function handleExport(format: ExportFormat): void {
    setDropdownOpen(false);

    if (format === 'csv') {
      const csv = convertToCSV(data, columns);
      const dateSuffix = new Date().toISOString().slice(0, 10);
      downloadBlob(csv, `${filename}_${dateSuffix}.csv`, 'text/csv;charset=utf-8;');
      return;
    }

    // XLSX stub
    const csv = convertToCSV(data, columns);
    const dateSuffix = new Date().toISOString().slice(0, 10);
    downloadBlob(csv, `${filename}_${dateSuffix}.csv`, 'text/csv;charset=utf-8;');
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setDropdownOpen((prev) => !prev)}
        className={cn(
          'inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent',
          className,
        )}
        aria-label="エクスポートオプション"
        aria-expanded={dropdownOpen}
        aria-haspopup="true"
      >
        <Download size={14} />
        <span>エクスポート</span>
        <ChevronDown size={14} className={cn('transition-transform', dropdownOpen && 'rotate-180')} />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 z-50 mt-1 w-44 overflow-hidden rounded-md border border-border bg-card shadow-lg">
          <button
            type="button"
            onClick={() => handleExport('csv')}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
          >
            <FileText size={14} className="text-green-600" />
            CSV (.csv)
          </button>
          <button
            type="button"
            onClick={() => handleExport('xlsx')}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
          >
            <FileSpreadsheet size={14} className="text-blue-600" />
            Excel (.xlsx) - CSV形式
          </button>
        </div>
      )}
    </div>
  );
}

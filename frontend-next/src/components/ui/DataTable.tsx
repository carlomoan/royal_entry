"use client";

import { useState, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, ArrowUpDown, X, Ban } from "lucide-react";
import { Input, Select, Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface FilterOption {
  key: string;
  label: string;
  options: Array<{ value: string; label: string }>;
}

export interface ColumnDef<T> {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  render: (row: T) => React.ReactNode;
}

export interface BulkAction {
  key: string;
  label: string;
  icon?: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "outline" | "ghost";
  onClick: (selectedIds: string[]) => void;
  className?: string;
}

export interface DataTableProps<T extends { id: string }> {
  data: T[];
  columns: ColumnDef<T>[];
  searchPlaceholder?: string;
  searchFields?: (keyof T)[];
  filters?: FilterOption[];
  sortField?: string;
  sortDir?: "asc" | "desc";
  pageSize?: number;
  bulkActions?: BulkAction[];
  emptyMessage?: string;
  rowKey?: (row: T) => string;
  showCheckboxes?: boolean;
  showSearch?: boolean;
  showFilters?: boolean;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  searchPlaceholder = "Search...",
  searchFields = [],
  filters = [],
  sortField: initialSortField,
  sortDir: initialSortDir = "asc",
  pageSize = 20,
  bulkActions = [],
  emptyMessage = "No data available",
  showCheckboxes = true,
  showSearch = true,
  showFilters = true,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [sortField, setSortField] = useState<string>(initialSortField || columns[0]?.key || "");
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialSortDir);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let result = [...data];
    if (search && searchFields.length > 0) {
      const q = search.toLowerCase();
      result = result.filter((row) =>
        searchFields.some((f) => {
          const v = row[f];
          return v != null && String(v).toLowerCase().includes(q);
        })
      );
    }
    for (const filter of filters) {
      const val = activeFilters[filter.key];
      if (!val) continue;
      result = result.filter((row: any) => {
        if (filter.key === "__global") return val === "true" ? (row as any).isGlobal : !(row as any).isGlobal;
        if (filter.key === "__unassigned") return val === "true" ? !(row as any).organizationId : !!((row as any).organizationId);
        return (row as any)[filter.key] === val;
      });
    }
    if (sortField) {
      result.sort((a: any, b: any) => {
        const av = (a[sortField] ?? "").toString().toLowerCase();
        const bv = (b[sortField] ?? "").toString().toLowerCase();
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [data, search, searchFields, filters, activeFilters, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === paged.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(paged.map((r) => r.id)));
  }, [paged, selectedIds]);

  const handleSort = (key: string) => {
    if (sortField === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(key);
      setSortDir("asc");
    }
  };

  const resetAll = () => {
    setSearch("");
    setActiveFilters({});
    setSortField(initialSortField || columns[0]?.key || "");
    setSortDir("asc");
    setSelectedIds(new Set());
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {(showSearch || showFilters) && (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          {showSearch && (
            <div className="flex-1 min-w-[220px]">
              <Input
                label="Search"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full"
              />
            </div>
          )}
          {showFilters && filters.map((f) => (
            <div key={f.key} className={cn("w-44", f.key === "__status" && "w-32")}>
              <Select label={f.label} value={activeFilters[f.key] || ""} onChange={(e) => { setActiveFilters((p) => ({ ...p, [f.key]: e.target.value })); setPage(1); }}>
                <option value="">All</option>
                {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </div>
          ))}
          {showSearch || showFilters ? (
            <Button variant="ghost" size="sm" onClick={resetAll}><X className="h-3.5 w-3.5" /> Reset</Button>
          ) : null}
        </div>
      )}

      {selectedIds.size > 0 && bulkActions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-navy-950 px-4 py-2.5 text-white shadow-md animate-fadeIn">
          <span className="text-xs font-semibold">{selectedIds.size} selected</span>
          <div className="mx-2 h-4 w-px bg-white/20" />
          {bulkActions.map((a) => (
            <Button
              key={a.key}
              variant="outline"
              size="sm"
              className={cn("border-white/20 bg-white/10 text-white hover:bg-white/20", a.className)}
              onClick={() => a.onClick(Array.from(selectedIds))}
            >
              {a.icon}
              {a.label}
            </Button>
          ))}
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={() => setSelectedIds(new Set())}>Clear</Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {showCheckboxes && (
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === paged.length && paged.length > 0}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded accent-gold-500"
                    aria-label="Select all"
                  />
                </th>
              )}
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn("px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500", c.width)}
                  style={c.width ? { width: c.width } : undefined}
                >
                  {c.sortable ? (
                    <button onClick={() => handleSort(c.key)} className="inline-flex items-center gap-1 hover:text-slate-900">
                      {c.label}
                      <ArrowUpDown className={cn("h-3 w-3", sortField === c.key ? "text-gold-600" : "text-slate-300")} />
                    </button>
                  ) : c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (showCheckboxes ? 1 : 0)} className="py-12 text-center text-sm text-slate-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paged.map((row) => {
                const isSelected = selectedIds.has(row.id);
                return (
                  <tr key={row.id} className={cn("transition", isSelected ? "bg-gold-50/40" : "hover:bg-slate-50")}>
                    {showCheckboxes && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(row.id)}
                          className="h-4 w-4 rounded accent-gold-500"
                          aria-label={`Select row ${row.id}`}
                        />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3">{c.render(row)}</td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > pageSize && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm">
          <span className="text-slate-500">
            Showing <span className="font-semibold text-slate-700">{(safePage - 1) * pageSize + 1}</span>–<span className="font-semibold text-slate-700">{Math.min(safePage * pageSize, filtered.length)}</span> of <span className="font-semibold text-slate-700">{filtered.length}</span>
          </span>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}><ChevronLeft className="h-4 w-4" /> Prev</Button>
            <span className="px-2 text-slate-600">Page {safePage} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>Next <ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;

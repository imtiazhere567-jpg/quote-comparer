"use client";

import type { ReactNode } from "react";
import { Pagination, usePaged } from "./pagination";

/**
 * A card table whose rows are rendered on the server and paged here, 10 per page.
 * `rows` are <tr> elements (each with a key).
 */
export function PagedTable({
  head,
  rows,
  noun,
  minWidth = 720,
  pageSize = 10,
}: {
  head: ReactNode;
  rows: ReactNode[];
  noun: string;
  minWidth?: number;
  pageSize?: number;
}) {
  const paged = usePaged(rows, pageSize);
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-sm" style={{ minWidth }}>
          <thead>{head}</thead>
          <tbody>{paged.rows}</tbody>
        </table>
      </div>
      {rows.length > 0 && (
        <div className="border-t border-border px-5 py-3">
          <Pagination page={paged.page} pageCount={paged.pageCount} total={paged.total} pageSize={pageSize} onChange={paged.setPage} noun={noun} />
        </div>
      )}
    </div>
  );
}

/** Same, for a simple list (<li> elements). */
export function PagedList({ items, noun, pageSize = 10 }: { items: ReactNode[]; noun: string; pageSize?: number }) {
  const paged = usePaged(items, pageSize);
  return (
    <div className="card overflow-hidden">
      <ul className="divide-y divide-border">{paged.rows}</ul>
      {items.length > 0 && (
        <div className="border-t border-border px-5 py-3">
          <Pagination page={paged.page} pageCount={paged.pageCount} total={paged.total} pageSize={pageSize} onChange={paged.setPage} noun={noun} />
        </div>
      )}
    </div>
  );
}

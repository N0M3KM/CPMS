// Convention: revisions are listed ascending by revisionNo and the current one is the last.
export const currentOf = <T,>(ascending: readonly T[]): T | null => ascending.at(-1) ?? null;

// For queries that need only the current revision: newest first, one row.
export const newestOnlyArgs = { orderBy: { revisionNo: 'desc' }, take: 1 } as const;

/**
 * File: index.ts
 *
 * Barrel for the json-render UI spec schemas. Import from `@/lib/jr/schema`.
 *
 *   datasource.zod.ts — the 9-type datasource contract (5 READ + 4 WRITE).
 *   page.zod.ts       — the complete page spec (Spec + datasources/init/watch)
 *                       and the on-disk app.json / pages/{id}.json wrappers.
 *   fragment.zod.ts   — the fragment system: $fragment refs, build() output,
 *                       authoring metadata, and the eject boundary manifest.
 *   types.ts          — the `Fragment<P>` authoring contract (TS interfaces).
 */

// Order matters for clean re-exports: datasource.zod owns the canonical
// `DataSource` type; fragment.zod re-exports the rest of the authoring contract
// from types.ts, so a separate `export * from "./types"` is unnecessary.
export * from "./datasource.zod";
export * from "./page.zod";
export * from "./fragment.zod";

/**
 * Blocks tab — the fragment registry browsed like the component catalog.
 * Groups blocks by tier (Generic / Domain) and bundle; each block expands its
 * $fragment ref to primitives and renders live against an in-memory mock
 * datasource (no app/backend needed). See showcase/blocks/BlockCatalog.tsx.
 */
import { BlockCatalog } from "@/showcase/blocks/BlockCatalog";

export default function BlocksPage() {
  return <BlockCatalog />;
}

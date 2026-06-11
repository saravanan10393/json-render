/**
 * Expansion + validation smoke test for the Blog/CMS fragment bundle.
 * Run: bun scripts/test-blog-fragments.ts
 */
import { blogFragments } from "../fragments/blog";
import { expandFragments } from "../lib/server/fragment-expander";
import { validatePageSpec } from "../lib/server/spec-validators";
import type { EntityDefinition } from "../lib/server/entity-store";

const entities: EntityDefinition[] = [
  {
    name: "Post",
    label: "Posts",
    fields: [
      { id: "Title", name: "Title", type: "text" },
      { id: "Slug", name: "Slug", type: "text" },
      { id: "Excerpt", name: "Excerpt", type: "text" },
      { id: "Body", name: "Body", type: "text" },
      { id: "AuthorName", name: "Author Name", type: "text" },
      { id: "Category", name: "Category", type: "select", options: ["General", "Technology", "Design", "Business", "News"] },
      { id: "Status", name: "Status", type: "select", options: ["Draft", "Published", "Archived"] },
      { id: "CoverUrl", name: "Cover URL", type: "text" },
      { id: "PublishedAt", name: "Published At", type: "date" },
    ],
  },
  {
    name: "Author",
    label: "Authors",
    fields: [
      { id: "Name", name: "Name", type: "text" },
      { id: "Bio", name: "Bio", type: "text" },
      { id: "AvatarUrl", name: "Avatar URL", type: "text" },
      { id: "Email", name: "Email", type: "text" },
    ],
  },
  {
    name: "Category",
    label: "Categories",
    fields: [
      { id: "Name", name: "Name", type: "text" },
      { id: "Description", name: "Description", type: "text" },
    ],
  },
];

const PAGES: Record<string, { root: string; elements: Record<string, unknown>; state?: Record<string, unknown> }> = {
  "Blog Dashboard": {
    root: "page",
    elements: {
      page: {
        type: "Stack",
        props: { direction: "vertical", gap: "lg", className: "p-8" },
        children: ["publish-stats"],
      },
      "publish-stats": {
        $fragment: "PublishStats",
        params: {
          stats: [
            { label: "Total Posts", bdo: "Post", type: "COUNT" },
            { label: "Published", bdo: "Post", type: "COUNT", filterField: "Status", filterValue: "Published" },
            { label: "Drafts", bdo: "Post", type: "COUNT", filterField: "Status", filterValue: "Draft" },
          ],
          columns: 3,
          showChart: true,
          chartEntity: "Post",
          chartGroupBy: "Category",
        },
      },
    },
  },

  "Posts": {
    root: "page",
    elements: {
      page: {
        type: "Stack",
        props: { direction: "vertical", gap: "lg", className: "p-8" },
        children: ["post-grid", "post-editor", "category-list"],
      },
      "post-grid": {
        $fragment: "PostGrid",
        params: {
          columns: 3,
          pageSize: 12,
          detailStatePath: "/ui/selectedPostId",
          editIdStatePath: "/ui/post-editor/editId",
          editorOpenPath: "/ui/post-editor/open",
        },
      },
      "post-editor": {
        $fragment: "PostEditor",
        params: {
          title: "Edit Post",
          refresh: ["post-grid-list"],
          categoryOptions: ["General", "Technology", "Design", "Business", "News"],
        },
      },
      "category-list": {
        $fragment: "CategoryList",
        params: {
          targetNs: "post-grid",
          title: "Categories",
          pageSize: 50,
        },
      },
    },
    state: {
      ui: { selectedPostId: "" },
      filters: { "post-grid": { search: "", Status: "", Category: "" } },
    },
  },

  "Author": {
    root: "page",
    elements: {
      page: {
        type: "Stack",
        props: { direction: "vertical", gap: "lg", className: "p-8" },
        children: ["author-card"],
      },
      "author-card": {
        $fragment: "AuthorCard",
        params: {
          idPath: "/ui/selectedAuthorId",
          authorNameStatePath: "/ui/selectedAuthorName",
        },
      },
    },
    state: {
      ui: { selectedAuthorId: "", selectedAuthorName: "" },
    },
  },
};

let failed = false;
for (const [name, page] of Object.entries(PAGES)) {
  const { spec, issues, expanded } = expandFragments(
    page as unknown as Record<string, unknown>,
    blogFragments as never,
  );
  if (issues.length) {
    failed = true;
    console.error(`${name}: EXPANSION ISSUES`);
    for (const i of issues) console.error("  -", i);
    continue;
  }
  const v = validatePageSpec({
    spec,
    validPageNames: Object.keys(PAGES),
    entities,
  });
  if (v.length) {
    failed = true;
    console.error(`${name}: VALIDATION ISSUES`);
    for (const i of v) console.error("  -", i);
    continue;
  }
  console.log(
    `${name}: ${expanded.length} fragments → ${Object.keys(spec.elements as object).length} elements, ` +
    `${Object.keys((spec.datasources as object) ?? {}).length} datasources — clean ✓`,
  );
}
process.exit(failed ? 1 : 0);

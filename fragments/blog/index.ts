/**
 * Blog/CMS fragment bundle.
 *
 * Standard entity contracts these fragments expect (field ids are FIXED —
 * define entities with exactly these ids):
 *
 *   Post:     Title(text) Slug(text) Excerpt(text) Body(text)
 *             AuthorName(text) Category(select) Status(select: Draft|Published|Archived)
 *             CoverUrl(text) PublishedAt(date)
 *   Author:   Name(text) Bio(text) AvatarUrl(text) Email(text)
 *   Category: Name(text) Description(text)
 */
import type { FragmentRegistry } from "@/lib/jr/schema";
import { PublishStats } from "./PublishStats";
import { PostGrid } from "./PostGrid";
import { PostEditor } from "./PostEditor";
import { AuthorCard } from "./AuthorCard";
import { CategoryList } from "./CategoryList";

export const blogFragments = {
  PublishStats,
  PostGrid,
  PostEditor,
  AuthorCard,
  CategoryList,
} as unknown as FragmentRegistry;

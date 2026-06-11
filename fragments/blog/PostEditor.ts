/**
 * PostEditor — create/edit Post dialog.
 *
 * Open contract (what siblings write to open this dialog):
 *   create: setState /ui/<ns>/editId = null, /form/<ns> = {}, /ui/<ns>/open = true
 *   edit:   setState /ui/<ns>/editId = "<postId>", then /ui/<ns>/open = true
 *
 * '<ns>-prefill' bdo.get fires when editId is set and copies the record into
 * the form draft via $cond (guards the create case).
 *
 * Datasources:
 *   <ns>-save    — bdo.save Post (create when no _id, update when _id set)
 *   <ns>-prefill — bdo.get Post by editId (skipUntilReady; on.success fills form)
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  title: z.string().default("Edit Post").describe("Dialog title."),
  refresh: z
    .array(z.string())
    .default([])
    .describe(
      "Same-page datasource names to re-fire after save (e.g. the PostGrid '<gridNs>-list').",
    ),
  categoryOptions: z
    .array(z.string())
    .default(["General", "Technology", "Design", "Business", "News"])
    .describe("Options for the Category select field."),
});
type P = z.infer<typeof Params>;

export const PostEditor: Fragment<P> = {
  name: "PostEditor",
  version: "1.0.0",
  description:
    "Blog/CMS create/edit Post dialog form. " +
    "Fields: Title(text), Slug(text), Excerpt(text), Body(textarea), Category(select), Status(select[Draft|Published|Archived]), CoverUrl(text). " +
    "Open contract: create → set /ui/<ns>/editId null + /form/<ns> {} + /ui/<ns>/open true; " +
    "edit → set /ui/<ns>/editId then /ui/<ns>/open true. " +
    "Prefill datasource '<ns>-prefill' (bdo.get, skipUntilReady) copies record into /form/<ns> on success via $cond. " +
    "Save datasource '<ns>-save' (bdo.save) creates or updates based on _id; closes dialog on success; refreshes named datasources. " +
    "Entity contract: Post(Title, Slug, Excerpt, Body, AuthorName, Category:select, Status:select[Draft|Published|Archived], CoverUrl, PublishedAt:date). " +
    "Datasources: '<ns>-save' (bdo.save Post), '<ns>-prefill' (bdo.get Post).",
  category: "form",
  params: Params as z.ZodType<P>,
  build: ({ title, refresh, categoryOptions }, ns) => {
    const ui = `/ui/${ns}`;
    const formPath = `/form/${ns}`;

    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Dialog",
        props: { title, description: null, openPath: `${ui}/open` },
        children: [`${ns}-body`],
      },
      [`${ns}-body`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "md" },
        children: [
          `${ns}-field-title`,
          `${ns}-field-slug`,
          `${ns}-field-excerpt`,
          `${ns}-field-body`,
          `${ns}-row-cat-status`,
          `${ns}-field-cover`,
          `${ns}-footer`,
        ],
      },

      // Title
      [`${ns}-field-title`]: {
        type: "Input",
        props: {
          label: "Title",
          name: "Title",
          type: "text",
          value: { $bindState: `${formPath}/Title` },
          placeholder: "Post title…",
        },
      },

      // Slug
      [`${ns}-field-slug`]: {
        type: "Input",
        props: {
          label: "Slug",
          name: "Slug",
          type: "text",
          value: { $bindState: `${formPath}/Slug` },
          placeholder: "post-slug",
        },
      },

      // Excerpt
      [`${ns}-field-excerpt`]: {
        type: "Input",
        props: {
          label: "Excerpt",
          name: "Excerpt",
          type: "text",
          value: { $bindState: `${formPath}/Excerpt` },
          placeholder: "Short summary…",
        },
      },

      // Body (Textarea)
      [`${ns}-field-body`]: {
        type: "Textarea",
        props: {
          label: "Body",
          name: "Body",
          value: { $bindState: `${formPath}/Body` },
          placeholder: "Post content…",
          rows: 6,
        },
      },

      // Category + Status row
      [`${ns}-row-cat-status`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "md", align: "end" },
        children: [`${ns}-field-category`, `${ns}-field-status`],
      },
      [`${ns}-field-category`]: {
        type: "Select",
        props: {
          label: "Category",
          name: "Category",
          options: categoryOptions,
          value: { $bindState: `${formPath}/Category` },
          placeholder: "Select category…",
        },
      },
      [`${ns}-field-status`]: {
        type: "Select",
        props: {
          label: "Status",
          name: "Status",
          options: ["Draft", "Published", "Archived"],
          value: { $bindState: `${formPath}/Status` },
          placeholder: "Select status…",
        },
      },

      // Cover URL
      [`${ns}-field-cover`]: {
        type: "Input",
        props: {
          label: "Cover Image URL",
          name: "CoverUrl",
          type: "text",
          value: { $bindState: `${formPath}/CoverUrl` },
          placeholder: "https://…",
        },
      },

      // Footer
      [`${ns}-footer`]: {
        type: "Stack",
        props: { direction: "horizontal", justify: "end", gap: "sm" },
        children: [`${ns}-cancel`, `${ns}-submit`],
      },
      [`${ns}-cancel`]: {
        type: "Button",
        props: { label: "Cancel", variant: "secondary", disabled: null },
        on: {
          press: { action: "setState", params: { statePath: `${ui}/open`, value: false } },
        },
      },
      [`${ns}-submit`]: {
        type: "Button",
        props: { label: "Save", variant: "primary", disabled: null },
        on: {
          press: { action: "datasource.fire", params: { name: `${ns}-save` } },
        },
      },
    };

    return {
      root: ns,
      elements: elements as never,
      state: {
        ui: { [ns]: { open: false, editId: null } },
        form: { [ns]: {} },
      },
      datasources: {
        [`${ns}-save`]: {
          type: "bdo.save",
          params: {
            bdo: "Post",
            valuesPath: formPath,
            _id: { $state: `${ui}/editId` },
            closePath: `${ui}/open`,
          },
          refresh,
          on: {
            success: [
              { action: "ui.toast", params: { message: "Post saved", kind: "success" } },
              { action: "setState", params: { statePath: formPath, value: {} } },
              { action: "setState", params: { statePath: `${ui}/editId`, value: null } },
            ],
          },
        },
        [`${ns}-prefill`]: {
          type: "bdo.get",
          params: { bdo: "Post", _id: { $state: `${ui}/editId` } },
          skipUntilReady: true,
          on: {
            success: [
              {
                action: "setState",
                params: {
                  statePath: formPath,
                  value: {
                    $cond: { $state: `${ui}/editId` },
                    $then: { $datasource: `${ns}-prefill/data` },
                    $else: {},
                  },
                },
              },
            ],
          },
        },
      } as never,
    };
  },
};

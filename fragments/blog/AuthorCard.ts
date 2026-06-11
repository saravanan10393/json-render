/**
 * AuthorCard — profile card for one Author: avatar, name, bio, and post count.
 *
 * Layout:
 *   - Avatar image + Name (h2) + Bio
 *   - Post count metric (COUNT of Post where AuthorName EQ author name)
 *
 * The page must seed idPath in state (e.g. "" or a real author _id).
 *
 * Datasources:
 *   <ns>-get   — bdo.get Author by idPath, skipUntilReady
 *   <ns>-count — bdo.metric COUNT Post grouped/filtered by AuthorName
 */
import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  idPath: z
    .string()
    .describe("State path holding the selected Author _id (e.g. /ui/selectedAuthorId)."),
  authorNameStatePath: z
    .string()
    .optional()
    .describe(
      "State path holding the Author's Name for filtering the post count. " +
      "Defaults to /ui/<ns>/authorName.",
    ),
});
type P = z.infer<typeof Params>;

export const AuthorCard: Fragment<P> = {
  name: "AuthorCard",
  version: "1.0.0",
  description:
    "Blog/CMS Author profile card: avatar image, Name, Bio, Email, and post count metric. " +
    "Reads Author via bdo.get (skipUntilReady). Post count from bdo.metric COUNT on Post filtered by AuthorName. " +
    "The page must seed idPath and authorNameStatePath in state. " +
    "Entity contract: Author(Name:text, Bio:text, AvatarUrl:text, Email:text); " +
    "Post(Title, AuthorName:text, Status:select[Draft|Published|Archived]). " +
    "Datasources: '<ns>-get' (bdo.get Author), '<ns>-count' (bdo.metric COUNT Post).",
  whenToUse:
    "Use when the user wants to show a writer's profile — their photo, name, bio, email, and how many posts they have written. Good for an author page or an 'about the author' panel next to blog content.",
  category: "display",
  previewParams: {
    idPath: "/ui/selectedAuthorId",
    authorNameStatePath: "/ui/selectedAuthorName",
  },
  params: Params as z.ZodType<P>,
  build: ({ idPath, authorNameStatePath }, ns) => {
    const getDs = `${ns}-get`;
    const countDs = `${ns}-count`;
    const namePath = authorNameStatePath ?? `/ui/${ns}/authorName`;
    const get = (field: string) => ({ $datasource: `${getDs}/data/${field}` });

    const elements: Record<string, Record<string, unknown>> = {
      [ns]: {
        type: "Card",
        props: { title: null, description: null, maxWidth: null, centered: null, className: null },
        children: [`${ns}-inner`],
      },
      [`${ns}-inner`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "md", align: "center" },
        children: [`${ns}-avatar`, `${ns}-info`, `${ns}-stats`],
      },

      // Avatar
      [`${ns}-avatar`]: {
        type: "Image",
        props: {
          src: get("AvatarUrl"),
          alt: get("Name"),
          width: 96,
          height: 96,
        },
      },

      // Name + Bio + Email
      [`${ns}-info`]: {
        type: "Stack",
        props: { direction: "vertical", gap: "xs", align: "center" },
        children: [`${ns}-name`, `${ns}-bio`, `${ns}-email`],
      },
      [`${ns}-name`]: {
        type: "Heading",
        props: { text: get("Name"), level: "h2" },
      },
      [`${ns}-bio`]: {
        type: "Text",
        props: { text: get("Bio"), variant: "muted" },
      },
      [`${ns}-email`]: {
        type: "Text",
        props: { text: get("Email"), variant: "muted" },
      },

      // Post count
      [`${ns}-stats`]: {
        type: "Stack",
        props: { direction: "horizontal", gap: "sm", align: "center" },
        children: [`${ns}-count-label`, `${ns}-count-value`],
      },
      [`${ns}-count-label`]: {
        type: "Text",
        props: { text: "Posts", variant: "muted" },
      },
      [`${ns}-count-value`]: {
        type: "Heading",
        props: {
          text: { $datasource: `${countDs}/data/value` },
          level: "h3",
        },
      },
    };

    return {
      root: ns,
      elements: elements as never,
      datasources: {
        [getDs]: {
          type: "bdo.get",
          params: { bdo: "Author", _id: { $state: idPath } },
          skipUntilReady: true,
        },
        [countDs]: {
          type: "bdo.metric",
          params: {
            bdo: "Post",
            Metric: [{ Type: "COUNT" }],
            Filter: {
              Operator: "AND",
              Condition: [
                {
                  LHSField: "AuthorName",
                  Operator: "EQ",
                  RHSValue: { $state: namePath },
                },
              ],
            },
          },
          skipUntilReady: true,
        },
      } as never,
      init: [{ action: "datasource.refresh", params: { names: [getDs, countDs] } }],
    };
  },
};

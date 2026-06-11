import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { shadcnComponentDefinitions } from "@/lib/jr/components/shadcn/catalog";
import { z } from "zod";
import { customComponentDefinitions } from "./components/custom/catalog";

/**
 * The single source of truth for what the agent is allowed to generate:
 * every shadcn component shipped by @json-render/shadcn plus the ported
 * custom kit (spread AFTER shadcn — its 8 primitive overrides win), and the
 * rapp action vocabulary handled by the runtime.
 */
export const catalog = defineCatalog(schema, {
  components: { ...shadcnComponentDefinitions, ...customComponentDefinitions },
  actions: {
    "ui.toast": {
      params: z.object({
        message: z.string(),
        kind: z.enum(["default", "success", "error"]).nullable(),
      }),
      description: "Show a toast notification.",
    },
    "ui.navigate": {
      params: z.object({
        to: z.string().describe("Target page name (e.g. 'Dashboard')."),
      }),
      description: "Navigate to another page of the app.",
    },
    "datasource.refresh": {
      params: z.object({
        names: z.array(z.string()).describe("Datasource names to (re)fire."),
      }),
      description: "Re-fire READ datasources by name.",
    },
    "datasource.fire": {
      params: z.object({
        name: z.string().describe("WRITE datasource name to fire."),
      }),
      description: "Fire a WRITE datasource (save/delete/submit).",
    },
  },
});

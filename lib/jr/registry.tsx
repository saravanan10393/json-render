"use client";

import { defineRegistry } from "@json-render/react";
import { shadcnComponents } from "@json-render/shadcn";
import { catalog } from "./catalog";
import { customComponents } from "./components/custom/components";

/**
 * Maps every catalog component to its real implementation. Spread order
 * matters: customComponents AFTER shadcn so the kit's primitive overrides win
 * (notably Stack's align:"stretch" default). Action impls here are type
 * placeholders — live handlers (router/toast/datasource-engine wired) are
 * registered per-page via JSONUIProvider's `handlers` prop.
 */
export const { registry } = defineRegistry(catalog, {
  components: { ...shadcnComponents, ...customComponents },
  actions: {
    "ui.toast": async () => {},
    "ui.navigate": async () => {},
    "datasource.refresh": async () => {},
    "datasource.fire": async () => {},
  },
});

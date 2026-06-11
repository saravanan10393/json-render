/**
 * File: types.ts
 * Created: 10/06/26.
 *
 * The Fragment contract — bounded surface per the design doc.
 *
 *   Fragment = { name, version, params (Zod), build(params, ns) }
 *   FragmentOutput = { root, elements, state?, datasources?, init? }
 *
 * No slots, no slotScope, no _overrides — customization is via params or
 * sibling-composition; everything else is eject. The expander materialises
 * each $fragment ref to primitives + boundary metadata at write time.
 *
 * Every emitted element id, datasource name, and state key MUST be prefixed
 * with `${ns}` so multi-instance composition is collision-free without a
 * separate ownership registry.
 */

import type { z } from "zod";

// --------------------------------------------------------------------------- //
//  Primitive shapes the build() function emits.                                //
//  Loose typing — we trust catalog-cli to validate the structural shape;      //
//  the build function focuses on producing the right tree.                     //
// --------------------------------------------------------------------------- //

export type Binding =
  | { $state: string }
  | { $bindState: string }
  | { $datasource: string }
  | { $item: string }
  | { $index: true }
  | { $template: string }
  | { $computed: { fn: string; args: unknown[] } };

export interface ElementSpec {
  type: string;
  props?: Record<string, unknown>;
  children?: string[];
  on?: Record<string, ActionDescriptor | ActionDescriptor[]>;
  repeat?: { statePath: string; key?: string };
  visible?: Binding | Binding[];
  _meta?: Record<string, unknown>;
}

export interface ActionDescriptor {
  action: string;
  params?: Record<string, unknown>;
}

export interface DataSource {
  type:
    | "bdo.list"
    | "bdo.get"
    | "bdo.metric"
    | "activity.list"
    | "activity.get"
    | "bdo.save"
    | "bdo.delete"
    | "activity.submit"
    | "workflow.start";
  params?: Record<string, unknown>;
  into?: string;
  refresh?: string[];
  debounceMs?: number;
  skipUntilReady?: boolean;
  oneShot?: boolean;
  on?: {
    success?: ActionDescriptor[];
    error?: ActionDescriptor[];
  };
}

export type InitAction = ActionDescriptor;

// --------------------------------------------------------------------------- //
//  The Fragment + FragmentOutput interfaces.                                   //
// --------------------------------------------------------------------------- //

export interface FragmentOutput {
  /** MUST equal `ns` passed to build(). The expander rejects mismatches. */
  root: string;
  elements: Record<string, ElementSpec>;
  state?: Record<string, unknown>;
  datasources?: Record<string, DataSource>;
  init?: InitAction[];
}

export interface Fragment<P> {
  name: string;
  version: string;
  /** Human-readable; appears in the LLM system-prompt registry enumeration. */
  description: string;
  /** Coarse grouping for the LLM prompt + telemetry. */
  category:
    | "product-display"
    | "browse"
    | "cart-checkout"
    | "account"
    | "promotion"
    | "review"
    | "layout"
    | "form"
    | "display";
  params: z.ZodType<P>;
  build: (params: P, ns: string) => FragmentOutput;
}

// --------------------------------------------------------------------------- //
//  Registry type.                                                              //
// --------------------------------------------------------------------------- //

export type FragmentRegistry = Record<string, Fragment<unknown>>;

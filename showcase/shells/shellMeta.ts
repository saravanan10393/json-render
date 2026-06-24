/** Re-export from the canonical home in lib/runtime — the showcase used to own
 *  this file but the agent prompt needs the same data, so it lives next to
 *  SHELL_COMPONENTS now. Keeping this re-export so showcase imports don't churn. */
export { SHELL_META, type ShellMeta } from "@/lib/runtime/shellMeta";

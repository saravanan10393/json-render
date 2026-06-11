import { Boxes } from "lucide-react";

/**
 * Blocks tab — reserved for prebuilt, composable section blocks. Work in
 * progress on the `blocks-showcase` branch; this is the placeholder.
 */
export default function BlocksPage() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground">
          <Boxes className="size-6" />
        </span>
        <h2 className="font-heading text-lg font-semibold">Blocks coming soon</h2>
        <p className="text-sm text-muted-foreground">
          Prebuilt, composable section blocks will live here — assembled from the components in the
          catalog.
        </p>
      </div>
    </div>
  );
}

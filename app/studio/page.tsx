import { StudioHome } from "@/components/studio/studio-home";
import {
  ensureStudioSandbox,
  listLibraryFragments,
  listSessions,
} from "@/lib/server/fragment-studio";

export const dynamic = "force-dynamic";

export default function StudioPage() {
  ensureStudioSandbox();
  return (
    <StudioHome
      sessions={listSessions()}
      library={listLibraryFragments()}
    />
  );
}

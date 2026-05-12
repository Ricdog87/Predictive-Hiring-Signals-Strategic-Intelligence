import { redirect } from "next/navigation";

/**
 * The Strategy Lab moved into the main dashboard as a tab. This route
 * remains so external bookmarks keep working — it just punts to the
 * Bloomberg-style dashboard with `?tab=strategy-lab`, which is what
 * `app/page.tsx` reads on hydrate.
 */
export default function StrategyLabRedirect() {
  redirect("/?tab=strategy-lab");
}

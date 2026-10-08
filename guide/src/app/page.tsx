import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Funnel } from "@/components/funnel/Funnel";
import { config, publicConfig } from "@/lib/server/config";
import { assign } from "@/lib/server/sessions";

// Runs before first paint. A token means a returning visitor: hide the stage
// until the session is restored, so they never see the cold open flash.
const RESUME_SCRIPT = `try{if(/(^#|&)t=/.test(location.hash)||localStorage.getItem("mde_guide_session"))document.documentElement.dataset.resuming="1";setTimeout(function(){delete document.documentElement.dataset.resuming},7000)}catch(e){}`;

/** First name from the ManyChat link, letters only, never stored server side. */
function cleanFirstName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.normalize("NFKC").replace(/[^\p{L}\s'\-]/gu, "").trim().slice(0, 30);
  return s || null;
}

export default async function Home({ searchParams }: PageProps<"/">) {
  await connection();
  const c = config();
  // Rollback switch: send everyone to the old PDF.
  if (!c.funnelEnabled && c.oldGuideUrl) redirect(c.oldGuideUrl);
  const sp = await searchParams;
  const arms = assign({ variant: sp._v, progress: sp._p });
  return (
    <main>
      <script dangerouslySetInnerHTML={{ __html: RESUME_SCRIPT }} />
      <Funnel config={publicConfig()} initial={{ ...arms, firstName: cleanFirstName(sp.fn) }} />
    </main>
  );
}

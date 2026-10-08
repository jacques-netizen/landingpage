import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Funnel } from "@/components/funnel/Funnel";
import { config, publicConfig } from "@/lib/server/config";

export default async function Home() {
  await connection();
  const c = config();
  // Rollback switch: send everyone to the old PDF.
  if (!c.funnelEnabled && c.oldGuideUrl) redirect(c.oldGuideUrl);
  return (
    <main>
      <Funnel config={publicConfig()} />
    </main>
  );
}

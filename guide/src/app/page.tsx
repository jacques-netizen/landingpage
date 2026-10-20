import { redirect } from "next/navigation";
import { connection } from "next/server";
import { optin, proof } from "@/lib/content";
import { config, publicConfig } from "@/lib/server/config";
import { Optin } from "./optin/Optin";
import "./optin/optin.css";

export const metadata = { title: optin.meta.title, description: optin.meta.description, robots: { index: false, follow: false } };

/** The opt-in page: three short steps, then the stage page for under the line or the call page for at or above it. */
export default async function Home({ searchParams }: PageProps<"/">) {
  await connection();
  const c = config();
  // Rollback switch: send everyone to the old PDF.
  if (!c.funnelEnabled && c.oldGuideUrl) redirect(c.oldGuideUrl);
  const sp = await searchParams;
  const r = optin.pageB.reviews;
  const cases = r.cases.map((id) => ({ id, item: proof(id) })).filter((x) => x.item);
  const testimonial = proof(r.testimonial) ?? null;
  return (
    <Optin
      config={publicConfig()}
      showSlots={sp.slots === "1"}
      proof={{ cases: cases.map((x) => ({ id: x.id, title: x.item!.title ?? "", figures: x.item!.figures ?? [] })), testimonial: testimonial ? { title: testimonial.title ?? "", url: testimonial.url ?? "", poster: testimonial.poster ?? "" } : null }}
    />
  );
}

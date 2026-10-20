import { redirect } from "next/navigation";
import { connection } from "next/server";
import { media, optin, proof } from "@/lib/content";
import { config, publicConfig } from "@/lib/server/config";
import { Optin, type Proof } from "./optin/Optin";
import "./optin/optin.css";

export const metadata = { title: optin.meta.title, description: optin.meta.description, robots: { index: false, follow: false } };

/** The opt-in page: name and contact, then the thanks page with the film, the call and the proof. */
export default async function Home({ searchParams }: PageProps<"/">) {
  await connection();
  const c = config();
  // Rollback switch: send everyone to the old PDF.
  if (!c.funnelEnabled && c.oldGuideUrl) redirect(c.oldGuideUrl);
  const sp = await searchParams;
  const cl = optin.clients;
  const t = proof(cl.testimonial);
  const approved: Proof = {
    logos: proof(cl.logos)?.logos ?? [],
    cases: cl.cases
      .map((x) => ({ id: x.proof, item: proof(x.proof), clip: x.clip }))
      .filter((x) => x.item)
      .map((x) => ({ id: x.id, title: x.item!.title ?? "", figures: x.item!.figures ?? [], clip: `/media/secrets/${x.clip}.mp4`, poster: `/media/secrets/${x.clip}.jpg` })),
    testimonial: t ? { title: t.title ?? "", url: t.url ?? "", poster: t.poster ?? "" } : null,
  };
  const filmItem = media[optin.pageB.video];
  const filmId = filmItem && filmItem.provider === "mux" && !filmItem.placeholder ? filmItem.id : null;
  return <Optin config={publicConfig()} showSlots={sp.slots === "1"} proof={approved} filmId={filmId} />;
}

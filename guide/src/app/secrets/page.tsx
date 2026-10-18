// The interactive guide: seven secrets, each one something to play with.
// Copy, numbers and clip slots live in content/secrets.json. Campaign
// figures come from the approved proof library.
import { connection } from "next/server";
import content from "../../../content/secrets.json";
import { proof, type ProofItem } from "@/lib/content";
import { config } from "@/lib/server/config";
import { Secrets } from "./Secrets";
import "../g/guide.css";
import "./secrets.css";

export const metadata = { title: content.meta.title, description: content.meta.description };

export default async function SecretsPage({ searchParams }: PageProps<"/secrets">) {
  await connection();
  const sp = await searchParams;
  const cases = content.cases.items
    .map((c) => ({ ...c, item: proof(c.proof) }))
    .filter((c): c is typeof c & { item: ProofItem } => Boolean(c.item && c.item.status === "approved"));
  return <Secrets cases={cases} bookingUrl={config().calBookingUrl} showSlots={sp.slots === "1"} />;
}

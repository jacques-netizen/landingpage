// GET /api/dashboard/leads?key=...: every submission as a CSV file, for the owner only.
import { passwordOk } from "@/lib/server/dashauth";
import { leadCsv, leadList } from "@/lib/server/leadlist";

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (!passwordOk(key)) return new Response("Not found", { status: 404 });
  const csv = leadCsv(await leadList(10000));
  const day = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="guide-submissions-${day}.csv"`,
      "cache-control": "no-store",
    },
  });
}

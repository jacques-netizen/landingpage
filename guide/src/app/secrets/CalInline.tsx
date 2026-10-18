"use client";
// The strategy call calendar, inline on the page so nobody has to leave.
import { useEffect } from "react";
import Cal, { getCalApi } from "@calcom/embed-react";

const NAMESPACE = "secrets";

export function CalInline({ url }: { url: string }) {
  let origin = "https://cal.com";
  let link = "";
  try {
    const u = new URL(url);
    origin = u.origin;
    link = u.pathname.replace(/^\/+|\/+$/g, "");
  } catch {
    /* fall through to the link below the calendar */
  }
  useEffect(() => {
    (async () => {
      const cal = await getCalApi({ namespace: NAMESPACE });
      cal("ui", { theme: "dark", layout: "month_view", styles: { branding: { brandColor: "#b8944f" } } } as never);
    })();
  }, []);
  if (!link) return null;
  return (
    <div className="sx-cal">
      <Cal namespace={NAMESPACE} calLink={link} calOrigin={origin} config={{ layout: "month_view", theme: "dark" }} style={{ width: "100%", minHeight: 620, overflow: "auto" }} />
    </div>
  );
}

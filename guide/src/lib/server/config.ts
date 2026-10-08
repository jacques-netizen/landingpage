// Runtime config from the environment. Every value has a safe default so the
// app runs locally with nothing set (see .env.example).
import "server-only";

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return v !== undefined && v !== "" && Number.isFinite(n) ? n : d;
};
const str = (v: string | undefined, d = "") => (v ?? "").trim() || d;
const share = (v: string | undefined, d: number) => Math.min(1, Math.max(0, num(v, d)));

export function config() {
  const e = process.env;
  return {
    siteUrl: str(e.SITE_URL, "http://localhost:3000").replace(/\/$/, ""),
    appSecret: str(e.APP_SECRET, "dev-only-secret-change-me"),
    isProd: e.NODE_ENV === "production",
    qualifyMin: num(e.BUDGET_QUALIFY_MIN, 3000),
    priorityMin: num(e.BUDGET_PRIORITY_MIN, 10000),
    variantSplit: share(e.VARIANT_SPLIT, 0.5),
    progressSplit: share(e.PROGRESS_SPLIT, 0.5),
    funnelEnabled: str(e.FUNNEL_ENABLED, "true") !== "false",
    oldGuideUrl: str(e.OLD_GUIDE_URL),
    whopJoinUrl: str(e.WHOP_JOIN_URL),
    calBookingUrl: str(e.CAL_BOOKING_URL),
    calWebhookSecret: str(e.CAL_WEBHOOK_SECRET),
    calBookedRedirectUrl: str(e.CAL_BOOKED_REDIRECT_URL, "https://book.maisondelites.com/booked"),
    turnstileSiteKey: str(e.NEXT_PUBLIC_TURNSTILE_SITE_KEY || e.TURNSTILE_SITE_KEY),
    turnstileSecret: str(e.TURNSTILE_SECRET),
    videoProvider: str(e.VIDEO_PROVIDER, "file"),
    metaPixelId: str(e.META_PIXEL_ID),
    metaCapiToken: str(e.META_CAPI_TOKEN),
    metaTestEventCode: str(e.META_TEST_EVENT_CODE),
    resendApiKey: str(e.RESEND_API_KEY),
    emailFrom: str(e.EMAIL_FROM, "Maison d'Élites <guide@maisondelites.com>"),
    emailReplyTo: str(e.EMAIL_REPLY_TO),
    emailFooterLegal: str(e.EMAIL_FOOTER_LEGAL, "Maison d'Élites"),
    emailSignature: str(e.EMAIL_SIGNATURE, "Maison d'Élites"),
    ghlToken: str(e.GHL_API_TOKEN),
    ghlLocationId: str(e.GHL_LOCATION_ID),
    ghlPipelineDmSetting: str(e.GHL_PIPELINE_DM_SETTING, "DM Setting"),
    ghlPipelineSales: str(e.GHL_PIPELINE_SALES, "Sales"),
    ghlStageMap: parseJson<Record<string, string>>(e.GHL_STAGE_MAP, { dm_setting_new: "New Lead", sales_booked: "Call Booked" }),
    ghlAppUrl: str(e.GHL_APP_URL, "https://app.gohighlevel.com").replace(/\/$/, ""),
    discordWebhookUrl: str(e.DISCORD_WEBHOOK_URL),
    manychatToken: str(e.MANYCHAT_API_TOKEN),
    manychatTagName: str(e.MANYCHAT_TAG_NAME, "guide-requested"),
    storage: {
      endpoint: str(e.STORAGE_ENDPOINT),
      bucket: str(e.STORAGE_BUCKET),
      accessKeyId: str(e.STORAGE_ACCESS_KEY_ID),
      secretAccessKey: str(e.STORAGE_SECRET_ACCESS_KEY),
      region: str(e.STORAGE_REGION, "auto"),
    },
    dashboardPassword: str(e.DASHBOARD_PASSWORD),
    cronSecret: str(e.CRON_SECRET),
  };
}

export type Config = ReturnType<typeof config>;

function parseJson<T>(v: string | undefined, d: T): T {
  if (!v) return d;
  try {
    return { ...d, ...JSON.parse(v) };
  } catch {
    return d;
  }
}

/** Values the browser needs. Nothing secret goes in here. */
export function publicConfig() {
  const c = config();
  return {
    qualifyMin: c.qualifyMin,
    priorityMin: c.priorityMin,
    whopJoinUrl: c.whopJoinUrl,
    calBookingUrl: c.calBookingUrl,
    calBookedRedirectUrl: c.calBookedRedirectUrl,
    turnstileSiteKey: c.turnstileSiteKey,
    metaPixelId: c.metaPixelId,
    videoProvider: c.videoProvider,
  };
}

export type PublicConfig = ReturnType<typeof publicConfig>;

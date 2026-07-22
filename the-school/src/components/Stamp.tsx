/**
 * The signature element (École design study §3): a stamp, earned per
 * shipped assignment, not a point or an XP bar. One glyph per campus,
 * geometric and monoline, drawing on the logic of adinkra stamping rather
 * than reproducing any specific traditional symbol.
 *
 * Purely presentational — campusKey selects the glyph, earned selects the
 * gold-pressed vs. blank-wax rendering. No data fetching here.
 */
const GLYPHS: Record<string, React.ReactNode> = {
  foundation: (
    <>
      <rect x="14" y="40" width="36" height="10" />
      <rect x="20" y="26" width="24" height="14" />
      <rect x="26" y="14" width="12" height="12" />
    </>
  ),
  outreach: (
    <>
      <line x1="14" y1="50" x2="50" y2="14" />
      <polyline points="34,14 50,14 50,30" />
      <circle cx="18" cy="46" r="3" />
    </>
  ),
  linkedin: (
    <>
      <rect x="14" y="14" width="36" height="36" rx="4" />
      <line x1="23" y1="28" x2="23" y2="40" />
      <line x1="32" y1="40" x2="32" y2="30" />
      <path d="M32 30 a5 5 0 0 1 9 0 v10" />
      <circle cx="23" cy="23" r="1.6" />
    </>
  ),
  crm: (
    <>
      <ellipse cx="32" cy="18" rx="16" ry="6" />
      <path d="M16 18 v12 a16 6 0 0 0 32 0 v-12" />
      <path d="M16 30 v12 a16 6 0 0 0 32 0 v-12" />
    </>
  ),
  ig: (
    <>
      <rect x="14" y="14" width="36" height="36" rx="10" />
      <circle cx="32" cy="32" r="9" />
      <circle cx="43" cy="21" r="1.8" />
    </>
  ),
  distribution: (
    <>
      <circle cx="32" cy="32" r="6" />
      <circle cx="16" cy="18" r="4" />
      <circle cx="48" cy="18" r="4" />
      <circle cx="20" cy="48" r="4" />
      <circle cx="46" cy="48" r="4" />
      <line x1="27" y1="28" x2="19" y2="21" />
      <line x1="37" y1="28" x2="45" y2="21" />
      <line x1="28" y1="37" x2="22" y2="45" />
      <line x1="37" y1="36" x2="43" y2="45" />
    </>
  ),
  youtube: (
    <>
      <rect x="12" y="18" width="40" height="28" rx="6" />
      <polygon points="28,27 28,37 38,32" />
    </>
  ),
  live: (
    <>
      <circle cx="32" cy="40" r="4" />
      <path d="M20 32 a17 17 0 0 1 24 0" />
      <path d="M12 24 a28 28 0 0 1 40 0" />
    </>
  ),
  deal: (
    <>
      <path d="M32 14 L46 20 V34 C46 44 39 50 32 52 C25 50 18 44 18 34 V20 Z" />
      <path d="M26 33 L30 38 L39 27" />
    </>
  ),
};

// Real campus slugs -> abstract glyph key.
export const CAMPUS_GLYPH: Record<string, string> = {
  "foundation-founders": "foundation",
  "foundation-artists": "foundation",
  outreach: "outreach",
  linkedin: "linkedin",
  "crm-systems": "crm",
  "crm-lite": "crm",
  "ig-organic": "ig",
  distribution: "distribution",
  "tiktok-live": "live",
  "brand-deals": "deal",
  youtube: "youtube",
};

export function Stamp({
  campusSlug,
  earned,
  size = 56,
}: {
  campusSlug: string;
  earned: boolean;
  size?: number;
}) {
  const glyphKey = CAMPUS_GLYPH[campusSlug] ?? "foundation";
  const inset = Math.max(3, Math.round(size * 0.085));
  const glyphSize = Math.round(size * 0.4);

  const rimBg = earned
    ? "repeating-conic-gradient(#7c5c28 0deg 3deg, #e0bd76 3deg 6deg)"
    : "repeating-conic-gradient(rgba(255,255,255,0.05) 0deg 3deg, rgba(255,255,255,0.11) 3deg 6deg)";
  const faceBg = earned
    ? "radial-gradient(circle at 38% 30%, #F5DE9C 0%, #D9B063 40%, #B0873E 74%, #7E5D2A 100%)"
    : "radial-gradient(circle at 38% 30%, #241f17 0%, #14100A 92%)";
  const faceShadow = earned
    ? "inset 0 2px 3px rgba(255,255,255,0.6), inset 0 -3px 6px rgba(70,45,10,0.5)"
    : "inset 0 2px 5px rgba(0,0,0,0.75), inset 0 -1px 1px rgba(255,255,255,0.04)";
  const dropShadow = earned
    ? "0 5px 14px rgba(0,0,0,0.45), 0 0 22px rgba(216,176,99,0.28)"
    : "0 2px 6px rgba(0,0,0,0.4)";
  const strokeColor = earned ? "#553f18" : "rgba(237,230,214,0.18)";

  return (
    <div
      style={{ position: "relative", width: size, height: size, borderRadius: "50%", flexShrink: 0, boxShadow: dropShadow }}
    >
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: rimBg }} />
      <div
        style={{
          position: "absolute",
          inset,
          borderRadius: "50%",
          background: faceBg,
          boxShadow: faceShadow,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width={glyphSize}
          height={glyphSize}
          viewBox="0 0 64 64"
          fill="none"
          stroke={strokeColor}
          strokeWidth={3.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {GLYPHS[glyphKey]}
        </svg>
      </div>
      {earned && (
        <div
          style={{
            position: "absolute",
            inset,
            borderRadius: "50%",
            pointerEvents: "none",
            background: "radial-gradient(circle at 36% 28%, rgba(255,255,255,0.55), rgba(255,255,255,0) 46%)",
          }}
        />
      )}
    </div>
  );
}

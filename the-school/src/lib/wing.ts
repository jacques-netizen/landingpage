/**
 * Wing accent: Founders and Artists share every part of the design system
 * and differ on exactly one variable — accent color (École design study §6).
 * Any school slug other than "artists" falls back to the gold default, so
 * adding a third school never requires a code change here.
 */
export type WingAccent = "text-gold" | "text-plum";

export function accentTextClass(schoolSlug: string | null | undefined): WingAccent {
  return schoolSlug === "artists" ? "text-plum" : "text-gold";
}

export function accentBorderClass(schoolSlug: string | null | undefined): string {
  return schoolSlug === "artists" ? "border-plum" : "border-gold";
}

export function accentBgClass(schoolSlug: string | null | undefined): string {
  return schoolSlug === "artists" ? "bg-plum" : "bg-gold";
}

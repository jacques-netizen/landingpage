// Brand and contact values come from the environment. Nothing is hard coded (docs/README.md, Placeholders).
export type BrandConfig = {
  brandName: string
  legalEntity: string
  contactEmail: string
  supportDiscordUrl: string
  appUrl: string
}

export function getBrand(env: Record<string, string | undefined> = process.env): BrandConfig {
  return {
    brandName: env.BRAND_NAME || 'BRAND_NAME',
    legalEntity: env.LEGAL_ENTITY || 'LEGAL_ENTITY',
    contactEmail: env.CONTACT_EMAIL || 'CONTACT_EMAIL',
    supportDiscordUrl: env.SUPPORT_DISCORD_URL || '',
    appUrl: env.APP_URL || 'http://localhost:3000',
  }
}

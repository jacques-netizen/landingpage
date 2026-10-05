import { and, desc, eq, lte } from 'drizzle-orm'
import type { DbOrTx } from './client'
import { legalDocuments, LEGAL_SLUGS } from './schema'

export type LegalSlug = (typeof LEGAL_SLUGS)[number]
export { LEGAL_SLUGS }

export type LegalVersion = { version: number; title: string; bodyMarkdown: string; effectiveAt: Date }

export const isLegalSlug = (s: string): s is LegalSlug => (LEGAL_SLUGS as readonly string[]).includes(s)

/** Every version already in force, newest first. The first one is the current text. */
export async function getLegalVersions(d: DbOrTx, slug: LegalSlug, now = new Date()): Promise<LegalVersion[]> {
  return d
    .select({
      version: legalDocuments.version,
      title: legalDocuments.title,
      bodyMarkdown: legalDocuments.bodyMarkdown,
      effectiveAt: legalDocuments.effectiveAt,
    })
    .from(legalDocuments)
    .where(and(eq(legalDocuments.slug, slug), lte(legalDocuments.effectiveAt, now)))
    .orderBy(desc(legalDocuments.version))
}

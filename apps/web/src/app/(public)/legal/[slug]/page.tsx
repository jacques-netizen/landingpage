import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db, getLegalVersions, isLegalSlug, LEGAL_SLUGS } from '@mde/db'
import { PlainText } from '@/components/plain-text'
import { PageHeading } from '@/components/public-page'
import { LEGAL_WORKING_TEXT } from '@/content/legal-working-text'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  if (!isLegalSlug(slug)) return {}
  return { title: `${LEGAL_WORKING_TEXT[slug].title} | Maison d'Élites` }
}

const dateFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' })

// Legal pages keep every version (01_PRODUCT.md 8.1). The newest version in force is shown, with
// earlier ones readable by number. Until the lawyer's text is saved, clearly marked working text shows.
export default async function LegalPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ version?: string }>
}) {
  const { slug } = await params
  const { version } = await searchParams
  if (!isLegalSlug(slug)) notFound()
  const versions = await getLegalVersions(db(), slug)
  const shown = version ? versions.find((v) => String(v.version) === version) : versions[0]
  if (version && !shown) notFound()

  return (
    <>
      <PageHeading
        title={shown?.title ?? LEGAL_WORKING_TEXT[slug].title}
        lead={
          shown ? (
            <>
              Version {shown.version}, in force from {dateFmt.format(shown.effectiveAt)}.
              {shown !== versions[0] ? (
                <>
                  {' '}
                  <Link href={`/legal/${slug}`}>Read the current version.</Link>
                </>
              ) : null}
            </>
          ) : undefined
        }
      />
      {shown ? null : (
        <p
          role="note"
          className="m-0 mb-10 max-w-[720px] rounded-input border border-solid border-line bg-white px-4 py-3 text-[14px]"
        >
          Working text. The final text from our lawyer replaces this page.
        </p>
      )}
      <PlainText text={shown?.bodyMarkdown ?? LEGAL_WORKING_TEXT[slug].body} />
      {versions.length > 1 ? (
        <section className="mt-16 max-w-[720px] border-0 border-t border-solid border-line pt-8">
          <h2 className="m-0 mb-4 text-[13px] font-medium text-muted-2">Earlier versions</h2>
          <ul className="m-0 list-none p-0 text-[14px]">
            {versions.slice(1).map((v) => (
              <li key={v.version} className="mb-2">
                <Link href={`/legal/${slug}?version=${v.version}`}>
                  Version {v.version}, from {dateFmt.format(v.effectiveAt)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <nav aria-label="Legal pages" className="mt-16 flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
        {LEGAL_SLUGS.filter((s) => s !== slug).map((s) => (
          <Link key={s} href={`/legal/${s}`}>
            {LEGAL_WORKING_TEXT[s].title}
          </Link>
        ))}
      </nav>
    </>
  )
}

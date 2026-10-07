import type { Metadata } from 'next'
import { BrowseView } from '@/designed/browse-view'
import { browseChrome, loadCards, loadFeatured, loadPastCards } from '@/server/browse'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: "Campaigns | Maison d'Élites",
  description: 'Open campaigns, their rate and the budget left.',
}

async function safely<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'campaigns screen data failed', err: String(err) }))
    return null
  }
}

// The hero and the campaign list load separately: if the list fails, the screen shows the mockup's
// error state inside the page, with the hero still in place.
export default async function CampaignsPage() {
  const [cards, featured, past, chrome] = await Promise.all([
    safely(loadCards()),
    safely(loadFeatured()),
    safely(loadPastCards()),
    browseChrome(),
  ])
  return (
    <BrowseView
      state={cards ? 'data' : 'error'}
      cards={cards ?? []}
      pastCards={past ?? []}
      featured={featured?.featured ?? null}
      overrides={featured?.overrides}
      theme={chrome.theme}
      account={chrome.account}
      signedIn={chrome.signedIn}
    />
  )
}

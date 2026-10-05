import { BrowseView } from '@/designed/browse-view'
import { browseChrome, loadFeatured } from '@/server/browse'

// The mockup's loading state: the hero in place while the campaign list loads.
export default async function Loading() {
  const [featured, chrome] = await Promise.all([loadFeatured().catch(() => null), browseChrome()])
  return (
    <BrowseView
      state="loading"
      cards={[]}
      featured={featured?.featured ?? null}
      overrides={featured?.overrides}
      theme={chrome.theme}
      account={chrome.account}
    />
  )
}

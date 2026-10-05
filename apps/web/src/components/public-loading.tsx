import { LoadingRows, Skeleton } from '@mde/ui'

export function PublicLoading() {
  return (
    <div role="status" aria-label="Loading" className="max-w-[720px]">
      <Skeleton className="mb-14 h-[128px] w-[70%] max-sm:h-20" />
      <LoadingRows rows={5} />
    </div>
  )
}

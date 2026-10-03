import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { cn } from './cn'

/** Hairline table. No zebra, no filled header. Dense is for staff screens. */
export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn('w-full border-collapse text-left text-body-sm', className)}
        {...props}
      />
    </div>
  )
}
export function THead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} />
}
export function TBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />
}
export function TR({
  className,
  interactive,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return (
    <tr
      className={cn(
        'border-b border-line',
        interactive && 'cursor-pointer transition-colors duration-150 hover:bg-ink/[0.03]',
        className,
      )}
      {...props}
    />
  )
}
export function TH({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        'sticky top-0 h-11 whitespace-nowrap border-b border-line bg-bg px-3 text-left text-body-sm font-normal text-ink-2 first:pl-0 last:pr-0',
        className,
      )}
      {...props}
    />
  )
}
export function TD({
  className,
  numeric,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        'h-11 px-3 align-middle first:pl-0 last:pr-0',
        numeric && 'tabular text-right',
        className,
      )}
      {...props}
    />
  )
}

import type { ReactNode } from 'react'
import { cn } from './cn'

export type Column<Row> = {
  key: string
  header: string
  cell: (row: Row) => ReactNode
  align?: 'left' | 'right'
}

type Props<Row> = {
  columns: Column<Row>[]
  rows: Row[]
  rowKey: (row: Row) => string
  caption: string
  dense?: boolean
  onRowClick?: (row: Row) => void
  empty?: ReactNode
}

// Rows separated by hairlines. No zebra, no filled header. Sticky 13px header with a hairline under it.
// Dense mode is the admin table: 13px text, 44px rows, a faint hover.
export function Table<Row>({ columns, rows, rowKey, caption, dense, onRowClick, empty }: Props<Row>) {
  return (
    <table className="w-full border-collapse font-sans text-ink">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {columns.map((c) => (
            <th
              key={c.key}
              scope="col"
              className={cn(
                'sticky top-0 border-0 border-b border-solid border-line bg-page py-3 text-[13px] font-normal text-muted-2',
                c.align === 'right' ? 'text-right' : 'text-left',
                'px-3 first:pl-0 last:pr-0',
              )}
            >
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && empty ? (
          <tr>
            <td colSpan={columns.length} className="p-0">
              {empty}
            </td>
          </tr>
        ) : (
          rows.map((r) => (
            <tr
              key={rowKey(r)}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={cn(onRowClick && 'cursor-pointer', 'hover:bg-[rgba(26,21,16,0.03)]')}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    'border-0 border-b border-solid border-line px-3 first:pl-0 last:pr-0',
                    dense ? 'h-11 text-[13px]' : 'h-14 text-[15px]',
                    c.align === 'right' && 'text-right tabular-nums',
                  )}
                >
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  )
}

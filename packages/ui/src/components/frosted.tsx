import type { HTMLAttributes } from 'react'
import { cn } from './cn'

/** Frosted glass card. Solid fallback is in tokens.css for browsers without backdrop-filter. */
export function FrostedCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mde-frosted rounded-card p-5', className)} {...props} />
}

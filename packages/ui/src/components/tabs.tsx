'use client'
import type { ComponentProps } from 'react'
import { Tabs as RxTabs } from 'radix-ui'
import { cn } from './cn'

export const Tabs = RxTabs.Root

export function TabsList({ className, ...props }: ComponentProps<typeof RxTabs.List>) {
  return <RxTabs.List className={cn('flex gap-6 border-b border-line', className)} {...props} />
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof RxTabs.Trigger>) {
  return (
    <RxTabs.Trigger
      className={cn(
        'relative -mb-px min-h-11 border-b-2 border-transparent px-0.5 text-body text-ink-2',
        'transition-colors duration-150 ease-calm hover:text-ink',
        'data-[state=active]:border-ink data-[state=active]:text-ink',
        className,
      )}
      {...props}
    />
  )
}

export function TabsContent({ className, ...props }: ComponentProps<typeof RxTabs.Content>) {
  return <RxTabs.Content className={cn('pt-6', className)} {...props} />
}

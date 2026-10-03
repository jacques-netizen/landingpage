import Link from 'next/link'
import { getBrand } from '@mde/config'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const brand = getBrand()
  return (
    <div className="mde-page flex min-h-screen flex-col">
      <header className="mx-auto w-full max-w-[1200px] px-6 py-6">
        <Link href="/" className="font-display text-display-sm">
          {brand.brandName}
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center px-6 pb-24">
        {children}
      </main>
    </div>
  )
}

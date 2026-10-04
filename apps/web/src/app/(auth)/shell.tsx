import type { ReactNode } from 'react'

// Sign in and sign up: a centred single column, 420px wide, on the page colour (05_DESIGN_SYSTEM.md section 8).
export function AuthShell({
  title,
  lead,
  children,
  footer,
}: {
  title: string
  lead?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="box-border min-h-screen bg-page px-6 pt-10 pb-24 font-sans text-ink">
      <a href="/" className="mx-auto block w-max">
        <img src="/designed/logo-nav-clear.png" alt="Maison d'Élites" className="block h-[22px] w-auto" />
      </a>
      <div className="mx-auto mt-20 w-full max-w-[420px]">
        <h1 className="m-0 font-serif text-[40px] leading-[1.05] font-normal tracking-[-0.02em]">{title}</h1>
        {lead ? <p className="mt-3 mb-0 text-[15px] leading-normal text-muted-2">{lead}</p> : null}
        <div className="mt-10">{children}</div>
        {footer ? (
          <div className="mt-10 border-0 border-t border-solid border-line pt-6 text-[14px] text-muted-2">{footer}</div>
        ) : null}
      </div>
    </main>
  )
}

import { cn } from './cn'

type Person = { name: string; src?: string | null }

// 32px circles with a 2px page-colour ring, overlapped by 10px, ending in a white plus circle.
// Only show a stack when it reflects real creators on that campaign.
export function AvatarStack({ people, more, label }: { people: Person[]; more?: boolean; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex items-center">
      {people.map((p, i) => (
        <span
          key={i}
          title={p.name}
          className={cn(
            'box-border flex size-8 items-center justify-center overflow-hidden rounded-full border-2 border-solid border-page bg-line font-sans text-[11px] font-semibold text-ink',
            i > 0 && '-ml-[10px]',
          )}
        >
          {p.src ? <img src={p.src} alt="" className="size-full object-cover" /> : initials(p.name)}
        </span>
      ))}
      {more ? (
        <span className="-ml-[10px] box-border flex size-8 items-center justify-center rounded-full border-2 border-solid border-page bg-white text-[15px] text-ink">
          +
        </span>
      ) : null}
    </div>
  )
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

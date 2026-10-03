import { cn } from './cn'
import { Plus } from './icons'

export type Person = { name: string; imageUrl?: string | null }

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')
  ).toUpperCase()
}

export function Avatar({
  person,
  size = 32,
  className,
}: {
  person: Person
  size?: number
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-line text-ink ring-2 ring-bg',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {person.imageUrl ? (
        <img src={person.imageUrl} alt={person.name} className="h-full w-full object-cover" />
      ) : (
        <span aria-label={person.name}>{initials(person.name)}</span>
      )}
    </span>
  )
}

/** Overlapped by 10px and ending in a plus circle. Pass only real creators. */
export function AvatarStack({ people, max = 4 }: { people: Person[]; max?: number }) {
  if (people.length === 0) return null
  return (
    <span
      className="inline-flex items-center"
      role="group"
      aria-label={`${people.length} creators`}
    >
      {people.slice(0, max).map((p, i) => (
        <Avatar key={`${p.name}-${i}`} person={p} className={i > 0 ? '-ml-2.5' : ''} />
      ))}
      <span className="-ml-2.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink ring-2 ring-bg">
        <Plus size={14} />
      </span>
    </span>
  )
}

// A creator's picture, or their first letter on gold when they have none.
export function AvatarImage({ src, name, size }: { src: string | null; name: string; size: number }) {
  return src ? (
    <img
      src={src}
      alt=""
      className="block flex-none rounded-[22%] object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      aria-hidden
      className="flex flex-none items-center justify-center rounded-[22%] font-app font-bold text-[#1A1510]"
      style={{ width: size, height: size, background: '#D8C58F', fontSize: size * 0.42 }}
    >
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  )
}

export function Caption({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`font-mono text-[11px] tracking-[0.14em] uppercase text-gold/75 ${className}`}>
      {children}
    </div>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight ${className}`}>
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
        <rect width="32" height="32" rx="9" fill="#7c3aed" />
        <rect x="7" y="9" width="18" height="16" rx="3" fill="none" stroke="#fff" strokeWidth="2.2" />
        <path d="M7 14h18M12 6v5M20 6v5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
        <path d="m12.5 19.5 2.5 2.5 4.5-5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Só Marcar
    </span>
  );
}

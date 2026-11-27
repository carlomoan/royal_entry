interface BrandLogoProps {
  className?: string;
  showName?: boolean;
  nameClassName?: string;
}

const DEFAULT_NAME_CLASSNAME =
  "bg-gradient-to-r from-navy-950 via-navy-800 to-gold-600 bg-clip-text font-bold leading-tight tracking-tight text-transparent";

export default function BrandLogo({
  className = "h-8 w-8 object-contain",
  showName = false,
  nameClassName = DEFAULT_NAME_CLASSNAME,
}: BrandLogoProps) {
  const logo = <img src="/RoyalEntrylogoVector.svg" alt="RoyalEntry" className={className} />;

  if (!showName) return logo;

  return (
    <span className="inline-flex min-w-0 items-center gap-2 align-middle">
      {logo}
      <span className={nameClassName}>RoyalEntry</span>
    </span>
  );
}

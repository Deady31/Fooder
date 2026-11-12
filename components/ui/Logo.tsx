interface LogoProps {
  className?: string;
}

export function Logo({ className = '' }: LogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src='/logo/fooder-pink.webp'
      alt='fooder'
      width={760}
      height={318}
      draggable={false}
      className={`select-none h-auto ${className}`}
    />
  );
}

interface LogoProps {
  variant?: 'pink' | 'gold';
  className?: string;
}

export function Logo({ variant = 'pink', className = '' }: LogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/logo/fooder-${variant}.webp`}
      alt='fooder'
      width={760}
      height={318}
      draggable={false}
      className={`select-none h-auto ${className}`}
    />
  );
}

import { ReactNode } from 'react';

interface LinkProps {
  children: ReactNode;
  href: string;
  className?: string;
  target?: string;
  rel?: string;
}

export const Link = ({
  children,
  href,
  className = '',
  target,
  rel
}: LinkProps) => {
  // Base classes - using CSS variables
  const baseClasses = `
    text-[var(--brand)]
    hover:text-[var(--brand-hover)]
    transition-[var(--transition-normal)]
    underline-offset-[var(--spacing-2)]
    hover:underline
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-[var(--spacing-2)]
  `;

  const classes = `${baseClasses} ${className}`;

  return (
    <a
      href={href}
      target={target}
      rel={rel}
      className={classes.trim()}
    >
      {children}
    </a>
  );
};
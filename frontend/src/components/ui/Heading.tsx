import { ReactNode } from 'react';

interface HeadingProps {
  children: ReactNode;
  as?: string | React.ComponentType<any>;
  size?: 'display' | 'h1' | 'h2' | 'h3' | 'h4';
  className?: string;
}

export const Heading = ({
  children,
  as = 'h1',
  size = 'display',
  className = ''
}: HeadingProps) => {
  // Base classes - using CSS variables for typography
  const baseClasses = `
    font-[var(--font-serif)]
    text-[var(--foreground)]
    tracking-[var(--tracking-tight)]
    leading-[var(--line-height-tight)]
    font-bold
  `;

  // Size classes using our fluid typography tokens
  const sizeClasses = {
    display: `text-[var(--font-size-display)]`,
    h1: `text-[var(--font-size-h1)]`,
    h2: `text-[var(--font-size-h2)]`,
    h3: `text-[var(--font-size-h3)]`,
    h4: `text-[var(--font-size-h4)]`,
  };

  const classes = `${baseClasses} ${sizeClasses[size]} ${className}`;

  const Tag = as;

  return (
    <Tag className={classes.trim()}>
      {children}
    </Tag>
  );
};
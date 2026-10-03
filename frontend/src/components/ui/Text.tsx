/// <reference types="next" />
/// <reference types="react" />
import { ReactNode } from 'react';

interface TextProps {
  children: ReactNode;
  as?: string | React.ComponentType<any>;
  variant?: 'default' | 'muted' | 'caption';
  className?: string;
  size?: 'base' | 'sm' | 'xs';
}

export const Text = ({
  children,
  as = 'p',
  variant = 'default',
  className = '',
  size = 'base'
}: TextProps) => {
  // Base classes - using CSS variables directly
  const baseClasses = `
    text-[var(--foreground)]
  `;

  // Size classes
  const sizeClasses = {
    base: `text-[var(--font-size-base)] leading-[var(--line-height-relaxed)]`,
    sm: `text-[var(--font-size-sm)] leading-[var(--line-height-relaxed)]`,
    xs: `text-[var(--font-size-xs)] leading-[var(--line-height-relaxed)]`,
  };

  // Variant classes
  const variantClasses = {
    default: ``, // Just use base styling
    muted: `text-[var(--muted)]`,
    caption: `text-[var(--muted)] text-[var(--font-size-xs)] leading-[var(--line-height-relaxed)] italic`,
  };

  const classes = `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`;

  const Tag = as;

  return (
    <Tag className={classes.trim()}>
      {children}
    </Tag>
  );
};
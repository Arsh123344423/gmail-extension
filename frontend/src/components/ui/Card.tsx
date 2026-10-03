import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  variant?: 'default' | 'outline' | 'inverted';
  className?: string;
}

export const Card = ({
  children,
  variant = 'default',
  className = ''
}: CardProps) => {
  // Base classes - using CSS variables
  const baseClasses = `
    rounded-[var(--radius-2xl)]
    border-[var(--border)]
    transition-[var(--transition-normal)]
  `;

  // Variant classes - using CSS variables
  const variantClasses = {
    default: `
      bg-[var(--background)]
    `,
    outline: `
      bg-[var(--background)]
    `,
    inverted: `
      bg-[var(--surface-dark)]
      text-[var(--surface-inverted-foreground)]
      border-[var(--border)]
    `
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${className}`;

  return (
    <div className={classes.trim()}>
      {children}
    </div>
  );
};
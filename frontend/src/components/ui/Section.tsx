import { ReactNode } from 'react';

interface SectionProps {
  children: ReactNode;
  className?: string;
  padding?: 'default' | 'large' | 'full';
  background?: boolean;
  margin?: 'default' | 'large' | 'none';
}

export const Section = ({
  children,
  className = '',
  padding = 'default',
  background = true,
  margin = 'default'
}: SectionProps) => {
  // Base classes - using CSS variables
  const baseClasses = `
    transition-[var(--transition-normal)]
  `;

  // Background classes - using CSS variables
  const backgroundClasses = background ? `bg-[var(--background)]` : `bg-transparent`;

  // Padding classes - using CSS variables
  const paddingClasses = {
    default: `py-[var(--spacing-6)] px-[var(--spacing-4)]`,
    large: `py-[var(--spacing-10)] px-[var(--spacing-6)]`,
    full: `py-[var(--spacing-12)]`
  };

  // Margin classes - using CSS variables
  const marginClasses = {
    default: `mb-[var(--spacing-6)]`,
    large: `mb-[var(--spacing-10)]`,
    none: `mb-0`
  };

  const classes = `${baseClasses} ${backgroundClasses} ${paddingClasses[padding]} ${marginClasses[margin]} ${className}`;

  return (
    <section className={classes.trim()}>
      {children}
    </section>
  );
};
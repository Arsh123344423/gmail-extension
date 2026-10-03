import { ReactNode } from 'react';

interface ButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  disabled = false,
  className = '',
  type = 'button'
}: ButtonProps) => {
  // Base classes - using CSS variables
  const baseClasses = `
    inline-flex min-w-0 max-w-full items-center justify-center gap-2
    whitespace-normal break-words text-center leading-snug font-medium
    transition-colors duration-200 ease-out
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-[var(--spacing-2)]
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  // Variant classes - using CSS variables
  const variantClasses = {
    primary: `
      bg-[var(--brand)] text-[var(--text)]
      hover:bg-[var(--brand-hover)]
      active:scale-[0.98]
    `,
    secondary: `
      bg-[var(--stone)] text-[var(--text)]
      hover:bg-[var(--brand)]/10
      active:scale-[0.98]
    `,
    outline: `
      border border-[var(--border)]
      bg-transparent
      text-[var(--text)]
      hover:bg-[var(--brand)]/10
      active:scale-[0.98]
    `
  };

  // Size classes - using CSS variables for spacing and radius
  const sizeClasses = {
    sm: `min-h-[calc(var(--spacing-4)*2)] px-[var(--spacing-3)] py-[var(--spacing-1)] text-[var(--font-size-sm)] rounded-[var(--radius-full)]`,
    md: `min-h-[calc(var(--spacing-5)*2)] px-[var(--spacing-4)] py-[var(--spacing-1)] text-[var(--font-size-base)] rounded-[var(--radius-full)]`,
    lg: `min-h-[calc(var(--spacing-6)*2)] px-[var(--spacing-5)] py-[var(--spacing-1)] text-[var(--font-size-lg)] rounded-[var(--radius-full)]`
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classes.trim()}
    >
      {children}
    </button>
  );
};
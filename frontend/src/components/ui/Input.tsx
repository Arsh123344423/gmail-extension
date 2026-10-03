import { Ref } from 'react';

interface InputProps {
  type?: 'text' | 'textarea' | 'email' | 'password';
  id?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  maxLength?: number;
  rows?: number;
  autoFocus?: boolean;
  ref?: Ref<HTMLInputElement | HTMLTextAreaElement>;
}

export const Input = ({
  type = 'text',
  id,
  value,
  onChange,
  placeholder = '',
  disabled = false,
  className = '',
  maxLength,
  rows,
  autoFocus = false,
  ref
}: InputProps) => {
  // Base classes - using CSS variables
  const baseClasses = `
    w-full
    rounded-[var(--radius-lg)]
    border-[var(--border)]
    bg-[var(--background)]
    text-[var(--foreground)]
    px-[var(--spacing-4)] py-[var(--spacing-3)]
    focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:ring-offset-[var(--spacing-2)]
    transition-[var(--transition-normal)]
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  // Type-specific classes - using CSS variables for spacing
  const typeClasses = type === 'textarea'
    ? `min-h-[calc(var(--spacing-6)*4)] resize-y`
    : `h-[calc(var(--spacing-5)*2)]`;

  const classes = `${baseClasses} ${typeClasses} ${className}`;

  if (type === 'textarea') {
    return (
      <textarea
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        className={classes.trim()}
        rows={rows}
        autoFocus={autoFocus}
        ref={ref as Ref<HTMLTextAreaElement> | undefined}
      />
    );
  }

  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      maxLength={maxLength}
      className={classes.trim()}
      autoFocus={autoFocus}
      ref={ref as Ref<HTMLInputElement> | undefined}
    />
  );
};
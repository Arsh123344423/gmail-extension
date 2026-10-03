/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // These will be overridden by our CSS variables, but we define them for TypeScript support
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        brand: 'var(--brand)',
        'brand-hover': 'var(--brand-hover)',
        surface: 'var(--surface)',
        'surface-dark': 'var(--surface-dark)',
        stone: 'var(--stone)',
        muted: 'var(--muted)',
      },
      // We'll use the CSS variables directly in most cases, but this helps with intellisense
      // Add support for our spacing scale (though we'll primarily use CSS vars)
      spacing: {
        '0': 'var(--spacing-0)',
        '1': 'var(--spacing-1)',
        '2': 'var(--spacing-2)',
        '3': 'var(--spacing-3)',
        '4': 'var(--spacing-4)',
        '5': 'var(--spacing-5)',
        '6': 'var(--spacing-6)',
        '7': 'var(--spacing-7)',
        '8': 'var(--spacing-8)',
        '9': 'var(--spacing-9)',
        '10': 'var(--spacing-10)',
        '12': 'var(--spacing-12)',
        '16': 'var(--spacing-16)',
        '20': 'var(--spacing-20)',
        '24': 'var(--spacing-24)',
      },
      // Add support for our radius scale
      borderRadius: {
        'none': 'var(--radius-none)',
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
        'full': 'var(--radius-full)',
      },
    },
  },
  plugins: [],
}
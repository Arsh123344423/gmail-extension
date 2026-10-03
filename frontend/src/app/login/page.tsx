'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button, Card, Heading, Text, Link } from '@/components/ui';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/+$/, '');

function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-[var(--text)]/30 border-t-[var(--text)] ${className}`}
    />
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5 shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.4-4.6 7l7.2 5.6c4.3-4 7.1-9.9 7.1-17.1z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.2-5.6c-2 1.4-4.7 2.3-8.7 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isCheckingAuth } = useAuth(true, false); // Redirect if authenticated

  const handleSignIn = () => {
    setIsLoading(true);
    setError(null);

    try {
      window.location.assign(`${BACKEND_URL}/auth/google`);
    } catch {
      setError("We couldn't start Google sign-in. Check your connection and try again.");
      setIsLoading(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <main
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--bg)]"
        role="status"
        aria-live="polite"
      >
        <Spinner className="h-6 w-6" />
        <Text variant="muted">Checking your session…</Text>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-[var(--bg)] px-5 py-12">
      <div className="w-full max-w-md">
        {/* Brand + promise */}
        <header className="mb-10 text-center">
          <Heading
            as="h1"
            size="display"
            className="font-serif text-[clamp(2.75rem,9vw,4.5rem)] font-normal leading-[1] tracking-[-0.03em] text-[var(--text)]"
          >
            Write now.
            <br />
            Send later.
          </Heading>
          <Text variant="muted" className="mx-auto mt-5 max-w-[32ch] text-base leading-relaxed text-[#666]">
            Schedule your Gmail messages with AI, at the time your reader is most likely to open them.
          </Text>
        </header>

        {/* Sign-in card */}
        <Card
          variant="default"
          className="rounded-[32px] border border-[var(--text)]/30 bg-[var(--stone)]/40 p-8 shadow-none"
        >
          <Heading
            as="h2"
            size="h2"
            className="mb-6 text-center font-serif text-3xl font-normal tracking-tight text-[var(--text)]"
          >
            Sign in to continue
          </Heading>

          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-3 rounded-2xl border border-[#7f1c34]/40 bg-[#7f1c34]/10 px-4 py-3"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#7f1c34" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-5 w-5 shrink-0">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5M12 16.5v.01" />
              </svg>
              <Text className="text-sm text-[#7f1c34]">{error}</Text>
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            onClick={handleSignIn}
            disabled={isLoading}
            aria-busy={isLoading}
            className="flex w-full items-center justify-center gap-3 rounded-full bg-[var(--surface-dark)]] px-6 py-4 text-base font-medium text-[var(--surface-dark)] duration-200 hover:bg-[var(--surface-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--text)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? (
              <>
                <Spinner />
                Redirecting to Google…
              </>
            ) : (
              <>
                <GoogleIcon />
                Continue with Google
              </>
            )}
          </Button>

          <Text variant="caption" className="mt-6 text-center text-sm leading-relaxed text-[#666]">
            By continuing, you agree to our{' '}
            <Link href="/terms" className="underline underline-offset-4 hover:text-[var(--text)]">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="underline underline-offset-4 hover:text-[var(--text)]">
              Privacy Policy
            </Link>
            .
          </Text>
        </Card>

        <footer className="mt-8 text-center">
          <Text variant="muted" className="text-sm text-[#666]">
            Trouble signing in?{' '}
            <Link
              href="mailto:support@yourdomain.com"
              className="text-[var(--text)] underline underline-offset-4 hover:no-underline"
            >
              Contact support
            </Link>
          </Text>
        </footer>
      </div>
    </main>
  );
}
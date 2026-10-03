'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button, Card, Heading, Text, Input } from '@/components/ui';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';
const MAX_CHARS = 500;

const EXAMPLES = [
  "Email maya@example.com tomorrow at 9:00 AM. Subject: Meeting. Body: Don't forget our 10 AM meeting.",
  'Remind sam@example.com on Friday at 8:30 AM to send the weekly report.',
  'Thank alex@example.com for the intro, send it Monday at 10:00 AM.',
];

type Status = { type: 'success' | 'error'; message: string } | null;

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[var(--text)]/30 border-t-[var(--text)]"
    />
  );
}

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const { user, isCheckingAuth } = useAuth(false, true); // Redirect if not authenticated

  const handleLogout = async () => {
    try {
      await fetch(`${BACKEND_URL}/auth/logout`, { credentials: 'include' });
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      window.location.href = '/login';
    }
  };

  const handleClear = () => {
    setPrompt('');
    setStatus(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setStatus({ type: 'error', message: 'Sign in with Google to schedule emails.' });
      return;
    }
    if (!prompt.trim()) {
      setStatus({ type: 'error', message: 'Describe the email you want to schedule.' });
      return;
    }

    setIsSubmitting(true);
    setStatus(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "We couldn't schedule that email.");

      setStatus({ type: 'success', message: data.message || 'Email scheduled.' });
      setPrompt('');
    } catch (error: unknown) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Something went wrong. Try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCheckingAuth || !user) {
    return (
      <main
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--bg)]"
        role="status"
        aria-live="polite"
      >
        <Spinner />
        <Text variant="muted">
          {isCheckingAuth ? 'Checking your session…' : 'Taking you to sign in…'}
        </Text>
      </main>
    );
  }

  const charCount = prompt.length;
  const nearLimit = charCount > MAX_CHARS * 0.9;

  return (
    <main className="min-h-screen bg-[var(--bg)] px-5 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        {/* Account bar */}
        <header className="mb-12 flex items-center gap-3 rounded-full border border-[var(--text)]/30 bg-[var(--stone)]/40 py-2 pl-2 pr-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={user.picture}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium text-[var(--text)]">{user.name}</p>
            <p className="truncate text-xs text-[#666]">{user.email}</p>
          </div>
          <Button
            variant="outline"
            size="md"
            onClick={handleLogout}
            className="shrink-0 rounded-full border border-[var(--text)]/30 px-4 py-2 text-sm text-[var(--text)] transition-colors hover:bg-[var(--brand)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text)]"
          >
            Sign out
          </Button>
        </header>

        {/* Hero */}
        <div className="mb-10">
          <Heading
            as="h1"
            size="display"
            className="font-serif text-[clamp(2.75rem,8vw,4.5rem)] font-normal leading-[1] tracking-[-0.03em] text-[var(--text)]"
          >
            What should we send, and when?
          </Heading>
          <Text variant="muted" className="mt-5 max-w-[46ch] text-base leading-relaxed text-[#666]">
            Describe the email in plain words, including who it goes to and when. We&apos;ll write it and schedule it.
          </Text>
        </div>

        {/* Composer */}
        <Card
          variant="default"
          className="rounded-[32px] border border-[var(--text)]/30 bg-[var(--stone)]/40 p-5 shadow-none sm:p-8"
        >
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <div>
              <label htmlFor="email-prompt" className="mb-3 block text-sm font-medium text-[var(--text)]">
                Your email
              </label>
              <div className="relative">
                <Input
                  id="email-prompt"
                  type="textarea"
                  value={prompt}
                  onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                    setPrompt(e.target.value)
                  }
                  placeholder="Send an email to john@example.com with subject 'Meeting Tomorrow' and body 'Don't forget our meeting at 10 AM' at 9:00 AM"
                  disabled={isSubmitting}
                  maxLength={MAX_CHARS}
                  rows={8}
                  className="w-full resize-none rounded-2xl border border-[var(--text)]/30 bg-[var(--bg)] px-4 pb-9 pt-4 text-base leading-relaxed text-[var(--text)] placeholder:text-[#666]/60 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--text)]"
                />
                <span
                  aria-live="polite"
                  className={`pointer-events-none absolute bottom-3 right-4 text-xs tabular-nums ${
                    nearLimit ? 'text-[#7f1c34]' : 'text-[#666]'
                  }`}
                >
                  {charCount}/{MAX_CHARS}
                </span>
              </div>

              {/* Starter examples */}
              {!prompt && !isSubmitting && (
                <div className="mt-4">
                  <p className="mb-2 text-sm text-[#666]">Try an example</p>
                  <div className="flex flex-wrap gap-2">
                    {EXAMPLES.map((example) => (
                      <button
                        key={example}
                        type="button"
                        onClick={() => setPrompt(example)}
                        className="max-w-full truncate rounded-full border border-[var(--text)]/30 px-4 py-2 text-left text-sm text-[var(--text)] transition-colors hover:bg-[var(--brand)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text)]"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={isSubmitting || !prompt.trim()}
                aria-busy={isSubmitting}
                className="flex w-full items-center justify-center gap-3 rounded-full bg-[var(--brand)] px-6 py-4 text-base font-medium text-[var(--text)] transition-colors duration-200 hover:bg-[var(--brand-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Spinner />
                    Scheduling…
                  </>
                ) : (
                  'Schedule email'
                )}
              </Button>

              {!isSubmitting && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={handleClear}
                  disabled={!prompt}
                  className="w-full rounded-full border border-[var(--text)]/30 px-6 py-4 text-base text-[var(--text)] transition-colors hover:bg-[var(--bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--text)] disabled:opacity-40 sm:w-auto"
                >
                  Clear
                </Button>
              )}
            </div>
          </form>
        </Card>

        {/* Result */}
        {status && (
          <div
            role={status.type === 'error' ? 'alert' : 'status'}
            className={`mt-6 flex items-start gap-3 rounded-3xl border px-5 py-4 ${
              status.type === 'success'
                ? 'border-[#034f46]/40 bg-[#034f46]/10 text-[#034f46]'
                : 'border-[#7f1c34]/40 bg-[#7f1c34]/10 text-[#7f1c34]'
            }`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mt-0.5 h-5 w-5 shrink-0"
            >
              {status.type === 'success' ? (
                <path d="M5 13l4 4L19 7" />
              ) : (
                <>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v5M12 16.5v.01" />
                </>
              )}
            </svg>
            <p className="text-base leading-snug">{status.message}</p>
          </div>
        )}
      </div>
    </main>
  );
}
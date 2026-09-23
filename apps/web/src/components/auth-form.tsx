"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const PROVIDER_LABELS: Record<string, string> = { google: "Google", github: "GitHub" };
const MIN_PASSWORD_LENGTH = 10;

export function AuthForm({
  mode,
  providers,
}: {
  mode: "sign-in" | "sign-up";
  providers: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setError(null);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "").trim();

    if (mode === "sign-up" && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    const result =
      mode === "sign-up"
        ? await authClient.signUp.email({ email, password, name: name || email })
        : await authClient.signIn.email({ email, password });

    if (result.error) {
      setError(result.error.message ?? "Could not sign you in. Check your details and try again.");
      return;
    }

    // New accounts have no organization yet; the onboarding page creates one.
    startTransition(() => {
      router.push(mode === "sign-up" ? "/onboarding" : "/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="mt-5">
      {providers.length > 0 && (
        <>
          <div className="grid gap-2">
            {providers.map((provider) => (
              <button
                key={provider}
                type="button"
                className="btn-secondary w-full"
                onClick={() =>
                  authClient.signIn.social({ provider: provider as "google" | "github", callbackURL: "/dashboard" })
                }
              >
                Continue with {PROVIDER_LABELS[provider] ?? provider}
              </button>
            ))}
          </div>
          <div className="my-5 flex items-center gap-3 text-xs text-[var(--color-muted)]">
            <span className="h-px flex-1 bg-[var(--color-line)]" />
            or
            <span className="h-px flex-1 bg-[var(--color-line)]" />
          </div>
        </>
      )}

      <form action={onSubmit} className="grid gap-3">
        {mode === "sign-up" && (
          <div>
            <label className="label" htmlFor="name">Name</label>
            <input id="name" name="name" className="field" autoComplete="name" placeholder="Ada Lovelace" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="field"
            placeholder="you@company.com"
          />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={mode === "sign-up" ? MIN_PASSWORD_LENGTH : undefined}
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
            className="field"
            placeholder={mode === "sign-up" ? `At least ${MIN_PASSWORD_LENGTH} characters` : "••••••••••"}
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary mt-1 w-full" disabled={pending}>
          {mode === "sign-up" ? "Create account" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

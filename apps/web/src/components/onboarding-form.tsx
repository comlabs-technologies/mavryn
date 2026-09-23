"use client";

import { useActionState } from "react";
import { createOrganization, type ActionState } from "@/lib/actions";

const initialState: ActionState = {};

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(createOrganization, initialState);

  return (
    <form action={formAction} className="grid gap-4">
      <div>
        <label className="label" htmlFor="name">Organization name</label>
        <input id="name" name="name" required className="field" placeholder="Acme Inc" />
      </div>

      <div>
        <label className="label" htmlFor="domain">Website</label>
        <input id="domain" name="domain" className="field" placeholder="https://acme.com" />
        <p className="mt-1.5 text-xs text-[var(--color-muted)]">
          Used for canonical URLs, RSS links and to reject canonicals pointing off your domain.
          You can add it later.
        </p>
      </div>

      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Creating…" : "Create organization"}
      </button>
      <p className="text-xs text-[var(--color-muted)]">
        We will set up Blog and Case Study content types for you.
      </p>
    </form>
  );
}

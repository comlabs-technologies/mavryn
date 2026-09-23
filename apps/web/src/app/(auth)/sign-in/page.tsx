import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { enabledOAuthProviders } from "@/lib/auth";
import { getSessionUser } from "@/lib/session";

export const metadata = { title: "Sign in" };

export default async function SignInPage() {
  if (await getSessionUser()) redirect("/dashboard");

  return (
    <div className="card p-6">
      <h1 className="text-lg font-semibold">Sign in</h1>
      <AuthForm mode="sign-in" providers={enabledOAuthProviders} />
      <p className="mt-5 text-center text-sm text-[var(--color-muted)]">
        No account?{" "}
        <Link href="/sign-up" className="font-medium text-[var(--color-accent)] hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}

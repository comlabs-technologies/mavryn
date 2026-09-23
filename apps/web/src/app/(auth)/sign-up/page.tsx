import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { enabledOAuthProviders } from "@/lib/auth";
import { getSessionUser } from "@/lib/session";

export const metadata = { title: "Create an account" };

export default async function SignUpPage() {
  if (await getSessionUser()) redirect("/dashboard");

  return (
    <div className="card p-6">
      <h1 className="text-lg font-semibold">Create an account</h1>
      <AuthForm mode="sign-up" providers={enabledOAuthProviders} />
      <p className="mt-5 text-center text-sm text-[var(--color-muted)]">
        Already have one?{" "}
        <Link href="/sign-in" className="font-medium text-[var(--color-accent)] hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

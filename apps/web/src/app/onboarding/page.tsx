import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { getDashboardContext, getSessionUser } from "@/lib/session";

export const metadata = { title: "Create your organization" };

export default async function OnboardingPage() {
  if (!(await getSessionUser())) redirect("/sign-in");
  if (await getDashboardContext()) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <h1 className="text-xl font-semibold tracking-tight">Create your organization</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Your content, API keys and media all live inside an organization. You can change any of
          this later in Settings.
        </p>
        <div className="card mt-6 p-6">
          <OnboardingForm />
        </div>
      </div>
    </main>
  );
}

import { redirect } from "next/navigation";
import { getDashboardContext, getSessionUser } from "@/lib/session";

export default async function RootPage() {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  const context = await getDashboardContext();
  redirect(context ? "/dashboard" : "/onboarding");
}

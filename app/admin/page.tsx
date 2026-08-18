import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminDashboardClient from "./AdminDashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  try {
    const auth = await getAuth();
    // In Next.js App Router server components, we pass the headers to getSession.
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.email) {
      redirect("/");
    }

    const userEmail = session.user.email.toLowerCase().trim();

    // Load admin emails from env
    const rawAdmins = process.env.ADMIN_EMAILS || "";
    const adminEmails = rawAdmins
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    // Fallback default admins in case env is not loaded properly
    const fallbackAdmins = [
      "skubidooskubi@gmail.com",
      "vikiflowdesign@gmail.com",
      "victoruche3022@gmail.com",
    ];

    const allowedAdmins = adminEmails.length > 0 ? adminEmails : fallbackAdmins;

    if (!allowedAdmins.includes(userEmail)) {
      console.warn(`[ADMIN ACCESS DENIED] Non-admin attempt by: ${userEmail}`);
      redirect("/");
    }

    return <AdminDashboardClient email={session.user.email} />;
  } catch (error) {
    // If the error is a Next.js redirect execution, rethrow it so Next.js redirects correctly.
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
      throw error;
    }
    console.error("[ADMIN PAGE ERROR]:", error);
    redirect("/");
  }
}

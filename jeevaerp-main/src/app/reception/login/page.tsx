import type { Metadata } from "next";
import { AuthScreen } from "@/components/portal/auth-screen";

export const metadata: Metadata = { title: "Sign in" };

export default function ReceptionLoginPage() {
  return <AuthScreen portalName="Front Desk" portalKey="reception" />;
}

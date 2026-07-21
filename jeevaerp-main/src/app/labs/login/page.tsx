import type { Metadata } from "next";
import { AuthScreen } from "@/components/portal/auth-screen";

export const metadata: Metadata = { title: "Sign in" };

export default function LabsLoginPage() {
  return <AuthScreen portalName="Laboratory" portalKey="labs" />;
}

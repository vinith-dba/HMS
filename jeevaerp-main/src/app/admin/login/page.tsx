import type { Metadata } from "next";
import { AuthScreen } from "@/components/portal/auth-screen";

export const metadata: Metadata = { title: "Sign in" };

export default function AdminLoginPage() {
  return <AuthScreen portalName="Admin" portalKey="admin" />;
}

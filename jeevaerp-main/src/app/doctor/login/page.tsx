import type { Metadata } from "next";
import { AuthScreen } from "@/components/portal/auth-screen";

export const metadata: Metadata = { title: "Sign in" };

export default function DoctorLoginPage() {
  return <AuthScreen portalName="Consulting Room" portalKey="doctor" />;
}

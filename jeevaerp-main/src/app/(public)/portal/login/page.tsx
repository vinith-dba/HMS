import type { Metadata } from "next";
import { PortalLogin } from "@/components/booking/portal-login";

export const metadata: Metadata = { title: "Patient portal" };

export default function PortalLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-blue-soft px-5 py-32">
      <PortalLogin />
    </div>
  );
}

import { Hero } from "@/components/marketing/hero";
import { ActionBar } from "@/components/marketing/action-bar";
import { Ticker } from "@/components/marketing/ticker";
import { Trust } from "@/components/marketing/trust";
import { Facilities } from "@/components/marketing/facilities";
import { NumbersBand } from "@/components/marketing/numbers-band";
import { Assurance } from "@/components/marketing/assurance";
import { Departments } from "@/components/marketing/why-choose";
import { SpecializedDoctors } from "@/components/marketing/specialized-doctors";
import { CareModel } from "@/components/marketing/care-model";
import { Journey } from "@/components/marketing/journey";
import { Wards } from "@/components/marketing/wards";
import { Testimonials } from "@/components/marketing/testimonials";
import { Faq } from "@/components/marketing/faq";
import { Visit } from "@/components/marketing/visit";
import { EmergencyBand } from "@/components/marketing/emergency";
import { PortalCta } from "@/components/marketing/portal-cta";

export default function HomePage() {
  return (
    <>
      <Hero />
      <ActionBar />
      <Ticker />
      <Trust />
      <CareModel />
      <Departments />
      <Facilities />
      <NumbersBand />
      <SpecializedDoctors />
      <Journey />
      <Wards />
      <Assurance />
      <Testimonials />
      <Visit />
      <Faq />
      <EmergencyBand />
      <PortalCta />
    </>
  );
}

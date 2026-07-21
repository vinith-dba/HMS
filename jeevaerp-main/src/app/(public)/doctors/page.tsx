import type { Metadata } from "next";
import { SectionHeading } from "@/components/ui/section-heading";
import { DoctorsDirectory } from "@/components/marketing/doctors-directory";
import { DOCTORS } from "@/lib/data";

export const metadata: Metadata = { title: "Our doctors" };

export default function DoctorsPage() {
  return (
    <div className="pb-8">
      <SectionHeading
        index="Our doctors"
        title="Find the right specialist."
        subtitle="Consultants across eight departments. Filter by speciality, check their OPD hours, and book the slot that suits you."
      />
      <div className="mt-12">
        <DoctorsDirectory doctors={DOCTORS} />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { SectionHeading } from "@/components/ui/section-heading";
import { BookingForm } from "@/components/booking/booking-form";

export const metadata: Metadata = { title: "Book an appointment" };

export default function BookPage() {
  return (
    <div className="pb-24">
      <SectionHeading
        index="Book an appointment"
        title="Pick a doctor. Pick a time."
        subtitle="Choose your department and a slot that suits you. Walk-ins are always welcome too — but booking ahead means you're not waiting."
      />
      <div className="mx-auto mt-12 max-w-[1200px] px-5 lg:px-8">
        <Suspense>
          <BookingForm />
        </Suspense>
      </div>
    </div>
  );
}

import { Reveal, CountUp } from "@/components/ui/reveal";
import { WARDS, DEPARTMENTS } from "@/lib/data";

/** The infrastructure, in numbers — a navy band, counted up on scroll. */
export function NumbersBand() {
  const beds = WARDS.reduce((s, w) => s + w.beds, 0);
  const icu = WARDS.find((w) => w.name === "ICU")?.beds ?? 0;

  const FIGURES: { value: React.ReactNode; label: string; sub: string }[] = [
    { value: <CountUp to={beds} />, label: "inpatient beds", sub: "across four ward classes" },
    { value: <CountUp to={icu} />, label: "ICU beds", sub: "continuously monitored" },
    { value: <CountUp to={DEPARTMENTS.length} />, label: "departments", sub: "consulting daily" },
    { value: <>24×7</>, label: "emergency", sub: "every day of the year" },
  ];

  return (
    <section className="px-3 py-6 sm:px-5">
      <Reveal className="mx-auto max-w-[1280px]">
        <div className="grid grid-cols-2 gap-y-10 rounded-[24px] bg-[var(--pine-ink)] px-8 py-12 text-white sm:px-12 lg:grid-cols-4 lg:py-14">
          {FIGURES.map((f) => (
            <div key={f.label} className="text-center lg:border-l lg:border-white/10 lg:first:border-l-0">
              <p className="display text-[clamp(2rem,3.6vw,2.8rem)]">{f.value}</p>
              <p className="mt-2 text-[13.5px] font-semibold">{f.label}</p>
              <p className="mt-0.5 text-[12px] text-white/50">{f.sub}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

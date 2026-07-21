import { Reveal } from "@/components/ui/reveal";

/**
 * Patient stories, scattered like notes around the heading on desktop and
 * stacked on mobile. The quotes are deliberately small and specific — the
 * kind of thing people actually say at the front desk, not review-site copy.
 */
const STORIES: { quote: string; name: string; role: string; tone: string }[] = [
  {
    quote: "The doctor already had my last visit open when I walked in. I didn't have to explain anything twice.",
    name: "Ramesh K.", role: "OPD patient", tone: "bg-[var(--sky-soft)] text-[var(--teal-deep)]",
  },
  {
    quote: "Blood test at 9, report on my phone before lunch. My father's diabetes review was done in one morning.",
    name: "Priya M.", role: "Attendant", tone: "bg-[var(--mint-soft)] text-[#3e7d5c]",
  },
  {
    quote: "They told me the ward rate before admission, and the discharge bill matched it to the rupee.",
    name: "Suresh V.", role: "IPD attendant", tone: "bg-[var(--peach-soft)] text-[var(--saffron)]",
  },
  {
    quote: "The pharmacist noticed the prescription was a day short and checked with the doctor before billing me.",
    name: "Lakshmi D.", role: "Pharmacy patient", tone: "bg-[var(--sky-soft)] text-[var(--teal-deep)]",
  },
  {
    quote: "Booked online for my mother at 8 in the morning — she was seen by 8:40.",
    name: "Anita R.", role: "Attendant", tone: "bg-[var(--mint-soft)] text-[#3e7d5c]",
  },
];

function Bubble({ s, className = "" }: { s: (typeof STORIES)[number]; className?: string }) {
  return (
    <figure className={`rounded-2xl border border-[var(--line)] bg-white p-4 shadow-[var(--shadow-sm)] ${className}`}>
      <blockquote className="text-[12.5px] leading-[1.65] text-[var(--ink-soft)]">&ldquo;{s.quote}&rdquo;</blockquote>
      <figcaption className="mt-3 flex items-center gap-2.5">
        <span className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold ${s.tone}`}>
          {s.name[0]}
        </span>
        <span className="text-[11.5px] text-[var(--muted)]">
          <span className="font-semibold text-[var(--ink)]">{s.name}</span> · {s.role}
        </span>
      </figcaption>
    </figure>
  );
}

function Heading() {
  return (
    <div className="text-center">
      <h2 className="display text-[clamp(1.9rem,3.6vw,2.6rem)] text-[var(--ink)]">
        Real stories, <span className="text-[var(--saffron)]">real care</span> —<br />
        hear from our <span className="text-[var(--teal)]">patients</span>
      </h2>
      <p className="mx-auto mt-4 max-w-md text-[14px] leading-[1.75] text-[var(--muted)]">
        What people tell us at the desk on their way out — kept short,
        exactly as they said it.
      </p>
    </div>
  );
}

export function Testimonials() {
  return (
    <section id="stories" className="px-3 py-16 sm:px-5 lg:py-24">
      <div className="mx-auto max-w-[1280px]">
        {/* desktop: four notes pinned to the corners, heading kept clear */}
        <div className="relative hidden min-h-[540px] lg:block">
          <div className="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2">
            <Heading />
          </div>
          <Reveal className="absolute left-0 top-0 w-60"><Bubble s={STORIES[0]} /></Reveal>
          <Reveal delay={80} className="absolute right-0 top-2 w-64"><Bubble s={STORIES[1]} /></Reveal>
          <Reveal delay={160} className="absolute bottom-4 left-8 w-64"><Bubble s={STORIES[2]} /></Reveal>
          <Reveal delay={240} className="absolute bottom-0 right-10 w-60"><Bubble s={STORIES[3]} /></Reveal>
        </div>

        {/* mobile / tablet: heading, then the notes in a simple flow */}
        <div className="lg:hidden">
          <Heading />
          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {STORIES.map((s) => <Bubble key={s.name} s={s} />)}
          </div>
        </div>
      </div>
    </section>
  );
}

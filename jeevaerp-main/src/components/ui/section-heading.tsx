import { Reveal } from "@/components/ui/reveal";

export function SectionHeading({
  index,
  title,
  subtitle,
}: {
  index?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mx-auto max-w-[1200px] px-5 pb-4 pt-32 lg:px-8 lg:pt-40">
      {index && (
        <Reveal><p className="sec-index">{index}</p></Reveal>
      )}
      <Reveal delay={60}>
        <h1 className="display mt-7 max-w-3xl text-[clamp(2.2rem,5vw,3.6rem)] text-[var(--ink)]">{title}</h1>
      </Reveal>
      {subtitle && (
        <Reveal delay={130}>
          <p className="mt-5 max-w-xl text-[16px] leading-[1.75] text-[var(--ink-soft)]">{subtitle}</p>
        </Reveal>
      )}
    </div>
  );
}

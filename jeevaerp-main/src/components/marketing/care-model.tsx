import { Reveal } from "@/components/ui/reveal";
import { DeptIcon } from "@/components/marketing/dept-icon";

/** Photo tile with a stat or caption sitting on a soft dark wash. */
function PhotoTile({ src, stat, label, caption, tall = false, delay = 0 }: {
  src: string; stat?: string; label?: string; caption?: { title: string; text: string }; tall?: boolean; delay?: number;
}) {
  return (
    <Reveal delay={delay} className={tall ? "lg:row-span-2" : ""}>
      <div className={`zoom-media relative h-full overflow-hidden rounded-[20px] ${tall ? "min-h-[420px]" : "min-h-[210px]"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={caption?.title ?? label ?? ""} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        <div aria-hidden className={`absolute inset-0 ${caption ? "bg-gradient-to-t from-[rgba(16,24,40,0.72)] via-[rgba(16,24,40,0.12)] to-transparent" : "bg-gradient-to-b from-[rgba(16,24,40,0.55)] via-[rgba(16,24,40,0.08)] to-transparent"}`} />
        {stat && (
          <div className="absolute left-5 top-5 text-white">
            <p className="display text-[34px] leading-none">{stat}</p>
            <p className="mt-1 max-w-[140px] text-[12.5px] leading-snug text-white/85">{label}</p>
          </div>
        )}
        {caption && (
          <div className="absolute inset-x-5 bottom-5 text-white">
            <p className="text-[14px] font-semibold">{caption.title}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-white/80">{caption.text}</p>
          </div>
        )}
      </div>
    </Reveal>
  );
}

/** Tint tile — the soft mint / peach / sky text cards. */
function TintTile({ tone, icon, title, text, delay = 0 }: {
  tone: "mint" | "peach" | "sky"; icon: string; title: string; text: string; delay?: number;
}) {
  const bg = tone === "mint" ? "bg-[var(--mint)]" : tone === "peach" ? "bg-[var(--peach)]" : "bg-[var(--sky-soft)]";
  const iconTone = tone === "peach" ? "text-[var(--saffron)]" : tone === "sky" ? "text-[var(--teal)]" : "text-[#3e7d5c]";
  return (
    <Reveal delay={delay}>
      <div className={`flex h-full min-h-[210px] flex-col rounded-[20px] p-5 transition-transform duration-300 ease-out hover:-translate-y-1 ${bg}`}>
        <span className={`${iconTone}`}><DeptIcon name={icon} className="h-6 w-6" /></span>
        <p className="mt-auto pt-6 text-[14.5px] font-semibold text-[var(--ink)]">{title}</p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">{text}</p>
      </div>
    </Reveal>
  );
}

/** The bento — why care here feels different, told in mixed cards. */
export function CareModel() {
  return (
    <section id="care" className="px-3 py-16 sm:px-5 lg:py-24">
      <div className="mx-auto max-w-[1280px]">
        <Reveal>
          <h2 className="display mx-auto max-w-xl text-center text-[clamp(1.9rem,3.6vw,2.6rem)] text-[var(--ink)]">
            Your health deserves more than just ok!
          </h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="mx-auto mt-4 max-w-lg text-center text-[14px] leading-[1.75] text-[var(--muted)]">
            Health issues aren&apos;t fun. That&apos;s why we make care easy, fast and
            personal — here&apos;s what that looks like on an ordinary day at Jeeva.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-flow-dense gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TintTile tone="mint" icon="General Medicine" title="Friendly experts"
            text="Skilled, attentive listeners — your doctor sees your full history before you say a word." />
          <PhotoTile tall src="/images/hospital_banner1.png" delay={60}
            caption={{ title: "Everything in one building", text: "Consultation, lab, pharmacy and admission — no running across town between them." }} />
          <PhotoTile src="/images/hospital_banner.jpeg" stat="24×7" label="Emergency, never closed" delay={120} />
          <TintTile tone="peach" icon="Fever" title="Quick appointments" delay={180}
            text="Same-day OPD, 8 AM – 8 PM. No waiting weeks to see someone — walk in or book online." />
          <PhotoTile src="/images/hero%20hospital%20banner.jpg" stat="30 min" label="Routine lab reports" delay={240} />
          <TintTile tone="sky" icon="Prevention" title="One ID, for life" delay={300}
            text="Every visit, scan, prescription and bill lives on your Jeeva ID — nothing is ever asked twice." />
        </div>
      </div>
    </section>
  );
}

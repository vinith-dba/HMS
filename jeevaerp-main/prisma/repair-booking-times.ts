/**
 * REPAIR: appointments booked at "00:00".
 *
 *   npx tsx prisma/repair-booking-times.ts
 *
 * The booking service used to select the slot WITHOUT `startTime`, so it wrote
 * `timeAtBooking: undefined`. The column carries `@default("00:00")`, so Prisma
 * quietly stored midnight rather than throwing. Every appointment booked through
 * the desk (as opposed to rescheduled) has the wrong time on it — on the queue,
 * on the printed OPD sheet, everywhere.
 *
 * The good news: `slotId` was written correctly, so the true time is still
 * recoverable from the slot. This backfills it.
 *
 * Safe to run more than once. Only touches rows that are actually wrong, and
 * only when a slot exists to read the truth from.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const broken = await prisma.appointment.findMany({
    where: { timeAtBooking: "00:00", slotId: { not: null } },
    select: { id: true, opNumber: true, slotId: true },
  });

  if (broken.length === 0) {
    console.log("✓ Nothing to repair — no appointment is stuck at 00:00.");
    return;
  }

  console.log(`Found ${broken.length} appointment(s) stored at 00:00. Repairing…\n`);

  let fixed = 0;
  let orphaned = 0;

  for (const a of broken) {
    const slot = await prisma.doctorSlot.findUnique({
      where: { id: a.slotId as string },
      select: { startTime: true },
    });

    if (!slot?.startTime) {
      // The slot was deleted (or genuinely holds no time). We cannot invent one:
      // guessing a consultation time on a medical record is worse than leaving it
      // visibly wrong. Report it and move on.
      console.log(`  ⚠ ${a.opNumber} — slot missing, cannot recover. Fix by hand.`);
      orphaned++;
      continue;
    }

    await prisma.appointment.update({
      where: { id: a.id },
      data: { timeAtBooking: slot.startTime },
    });
    console.log(`  ✓ ${a.opNumber} → ${slot.startTime}`);
    fixed++;
  }

  console.log(`\n✓ Repaired ${fixed}.`);
  if (orphaned > 0) {
    console.log(`⚠ ${orphaned} could not be recovered (their slot is gone). Correct these by hand.`);
  }

  // Anything at 00:00 with NO slot at all was likely cancelled — its slot was
  // released and slotId nulled. Flag them so nobody is surprised later.
  const noSlot = await prisma.appointment.count({
    where: { timeAtBooking: "00:00", slotId: null },
  });
  if (noSlot > 0) {
    console.log(`\nNote: ${noSlot} appointment(s) sit at 00:00 with no slot (usually cancelled ones).`);
    console.log("Their original time is not recoverable from the database. Left untouched.");
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

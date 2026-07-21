import { prisma } from "@/lib/prisma";

/** "HH:MM" -> minutes since midnight. */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** minutes since midnight -> "HH:MM". */
function toHHMM(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Generate concrete bookable slots for the next `days` days from every active
 * DoctorSchedule template. Idempotent: the [doctorId, date, startTime] unique
 * constraint means re-running never creates duplicates (skipDuplicates).
 *
 * Returns how many new slots were created — call this from a daily cron, or
 * on-demand before showing a booking screen.
 */
export async function generateSlots(days = 7): Promise<{ created: number }> {
  const schedules = await prisma.doctorSchedule.findMany({
    where: { isActive: true },
    select: {
      doctorId: true, dayOfWeek: true, startTime: true, endTime: true, slotDurationMin: true,
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows: {
    doctorId: string; date: Date; startTime: string; endTime: string; isBooked: boolean;
  }[] = [];

  for (let d = 0; d < days; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() + d);
    const dow = date.getDay(); // 0=Sun..6=Sat

    for (const sch of schedules) {
      if (sch.dayOfWeek !== dow) continue;
      const start = toMinutes(sch.startTime);
      const end = toMinutes(sch.endTime);
      for (let t = start; t + sch.slotDurationMin <= end; t += sch.slotDurationMin) {
        rows.push({
          doctorId: sch.doctorId,
          date,
          startTime: toHHMM(t),
          endTime: toHHMM(t + sch.slotDurationMin),
          isBooked: false,
        });
      }
    }
  }

  if (rows.length === 0) return { created: 0 };

  const result = await prisma.doctorSlot.createMany({
    data: rows,
    skipDuplicates: true, // the unique [doctorId,date,startTime] makes this safe to re-run
  });

  return { created: result.count };
}


/**
 * Switch the booking grid to a fresh cadence: set every active schedule's slot
 * length (default 10 min), drop future slots that are still free (keeping booked
 * and blocked ones untouched), then regenerate. Reception/admin action.
 */
export async function regenerateFutureSlots(minutes = 10, days = 14): Promise<{ created: number; cleared: number }> {
  await prisma.doctorSchedule.updateMany({ where: { isActive: true }, data: { slotDurationMin: minutes } });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const cleared = await prisma.doctorSlot.deleteMany({ where: { date: { gte: today }, isBooked: false, isBlocked: false } });
  const { created } = await generateSlots(days);
  return { created, cleared: cleared.count };
}

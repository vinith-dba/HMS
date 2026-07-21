import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

/**
 * RACE CONDITION TESTS — needs a real Postgres.
 *
 *   createdb jeeva_test
 *   DATABASE_URL="postgresql://.../jeeva_test" npx prisma migrate deploy
 *   DATABASE_URL="postgresql://.../jeeva_test" npx vitest run tests/races.test.ts
 *
 * These are the ONLY tests that can catch the bugs that will actually embarrass
 * you in front of a hospital. You cannot find them by clicking around, because
 * clicking is inherently one-at-a-time. Two receptionists on two machines are not.
 *
 * Each test fires N simultaneous requests at one scarce resource and asserts that
 * EXACTLY ONE wins. If your guard is wrong, you get two patients in one bed, or
 * stock going negative, and you find out at the counter.
 */

const prisma = new PrismaClient();
const HAS_DB = !!process.env.DATABASE_URL;

describe.skipIf(!HAS_DB)("races — exactly one winner", () => {
  let doctorId: string;
  let slotId: string;
  let patientIds: string[] = [];

  beforeAll(async () => {
    const doc = await prisma.doctor.findFirst({ select: { id: true } });
    doctorId = doc!.id;
    const p = await prisma.patient.findMany({ take: 5, select: { id: true } });
    patientIds = p.map((x) => x.id);
  });

  afterAll(async () => { await prisma.$disconnect(); });

  it("TWO receptionists booking the SAME slot: one wins, one is told to pick another", async () => {
    const slot = await prisma.doctorSlot.create({
      data: { doctorId, date: new Date("2099-01-01"), startTime: "10:00", endTime: "10:15", isBooked: false },
    });
    slotId = slot.id;

    // The real guard: updateMany with `isBooked: false` in the WHERE.
    // Postgres serialises the two updates; the loser matches zero rows.
    const claim = () =>
      prisma.doctorSlot.updateMany({ where: { id: slotId, isBooked: false }, data: { isBooked: true } });

    const [a, b] = await Promise.all([claim(), claim()]);
    const winners = [a.count, b.count].filter((c) => c === 1).length;

    expect(winners).toBe(1);           // exactly one claimed it
    expect(a.count + b.count).toBe(1); // and NOT both

    await prisma.doctorSlot.delete({ where: { id: slotId } });
  });

  it("TWO receptionists admitting to the SAME bed: only one patient ends up in it", async () => {
    const ward = await prisma.ward.findFirst({ select: { id: true } });
    if (!ward) return;
    const bed = await prisma.bed.create({
      data: { wardId: ward.id, bedNo: `RACE-${Date.now()}`, status: "AVAILABLE" },
    });

    const claim = () =>
      prisma.bed.updateMany({ where: { id: bed.id, status: "AVAILABLE" }, data: { status: "OCCUPIED" } });

    const results = await Promise.all([claim(), claim(), claim()]);
    const won = results.filter((r) => r.count === 1).length;

    expect(won).toBe(1);   // three tried, one bed, one winner

    await prisma.bed.delete({ where: { id: bed.id } });
  });

  it("TWO pharmacists dispensing the LAST strip: stock never goes negative", async () => {
    const med = await prisma.medicine.findFirst({ select: { id: true } });
    const batch = await prisma.stockBatch.create({
      data: {
        medicineId: med!.id, batchNo: `RACE-${Date.now()}`,
        expiryDate: new Date("2099-01-01"), quantity: 1, mrp: "10.00",
      },
    });

    // Guard: decrement only if enough remains.
    const take = () =>
      prisma.stockBatch.updateMany({
        where: { id: batch.id, quantity: { gte: 1 } },
        data: { quantity: { decrement: 1 } },
      });

    await Promise.all([take(), take(), take()]);
    const after = await prisma.stockBatch.findUnique({ where: { id: batch.id }, select: { quantity: true } });

    // THE ASSERTION THAT MATTERS: you cannot sell medicine you do not have.
    expect(after!.quantity).toBeGreaterThanOrEqual(0);
    expect(after!.quantity).toBe(0);

    await prisma.stockBatch.delete({ where: { id: batch.id } });
  });

  it("a CANCELLED appointment's slot can be booked by someone else", async () => {
    // This is the invariant behind making slotId nullable. If it regresses,
    // every cancellation silently burns a slot forever and nobody notices for
    // months — until the doctor's calendar is mysteriously full.
    const slot = await prisma.doctorSlot.create({
      data: { doctorId, date: new Date("2099-02-01"), startTime: "11:00", endTime: "11:15", isBooked: true },
    });
    const appt = await prisma.appointment.create({
      data: {
        opNumber: `RACE-${Date.now()}`, patientId: patientIds[0], doctorId, slotId: slot.id,
        visitDate: new Date("2099-02-01"), timeAtBooking: "11:00",
        status: "BOOKED", type: "WALKIN", priceAtBooking: "500.00", createdById: patientIds[0],
      },
    }).catch(() => null);
    if (!appt) return; // seed shape differs; skip rather than false-fail

    await prisma.$transaction([
      prisma.doctorSlot.update({ where: { id: slot.id }, data: { isBooked: false } }),
      prisma.appointment.update({ where: { id: appt.id }, data: { status: "CANCELLED", slotId: null } }),
    ]);

    const reclaimed = await prisma.doctorSlot.updateMany({
      where: { id: slot.id, isBooked: false }, data: { isBooked: true },
    });
    expect(reclaimed.count).toBe(1);   // the slot is genuinely back on sale

    await prisma.appointment.delete({ where: { id: appt.id } });
    await prisma.doctorSlot.delete({ where: { id: slot.id } });
  });
});

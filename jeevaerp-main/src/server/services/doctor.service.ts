import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import type { AuthUser } from "@/lib/auth/types";

// ---------------------------------------------------------------------------
// The doctor writes prescriptions BY HAND on paper. So this portal is a
// clinical *reading* surface, not a writer: who's waiting, what's their
// history, what did the lab find, what did I prescribe last time (the scan).
// ---------------------------------------------------------------------------

/**
 * Slot times are stored as "HH:MM" 24h STRINGS (see DoctorSlot in the schema),
 * not Dates. Format for display without pretending otherwise.
 */
function to12h(hhmm: string): string {
  const [hStr, m] = hhmm.split(":");
  const h = Number(hStr);
  if (Number.isNaN(h)) return hhmm;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m ?? "00"} ${suffix}`;
}

/** Resolve the Doctor row for a signed-in doctor user. */
async function doctorForUser(actor: AuthUser): Promise<{ id: string; name: string; department: string }> {
  const doc = await prisma.doctor.findUnique({
    where: { userId: actor.id },
    select: { id: true, name: true, department: true },
  });
  if (!doc) throw new ApiError(403, "This account isn't linked to a doctor profile");
  return doc;
}

export interface DoctorQueueItem {
  appointmentId: string; opNumber: string; time: string; status: string;
  patient: { id: string; displayId: string; fullName: string; age: number | null; gender: string | null; phone: string; bloodGroup: string | null };
}

/** Today's clinic list for this doctor — the queue they work through. */
export async function doctorToday(actor: AuthUser): Promise<{
  doctor: { name: string; department: string };
  stats: { booked: number; checkedIn: number; completed: number };
  queue: DoctorQueueItem[];
}> {
  const doc = await doctorForUser(actor);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const appts = await prisma.appointment.findMany({
    where: { doctorId: doc.id, visitDate: today, status: { not: "CANCELLED" } },
    orderBy: { timeAtBooking: "asc" },
    select: {
      id: true, opNumber: true, status: true,
      timeAtBooking: true,
      patient: {
        select: { id: true, displayId: true, fullName: true, age: true, gender: true, phone: true, bloodGroup: true },
      },
    },
  });

  type Row = {
    id: string; opNumber: string; status: string;
    timeAtBooking: string; // "HH:MM" — a string, not a Date
    patient: { id: string; displayId: string; fullName: string; age: number | null; gender: string | null; phone: string; bloodGroup: string | null };
  };

  const queue = (appts as Row[]).map((a) => ({
    appointmentId: a.id,
    opNumber: a.opNumber,
    time: to12h(a.timeAtBooking),
    status: a.status,
    patient: a.patient,
  }));

  return {
    doctor: { name: doc.name, department: doc.department },
    stats: {
      booked: queue.filter((q) => q.status === "BOOKED").length,
      checkedIn: queue.filter((q) => q.status === "CHECKED_IN").length,
      completed: queue.filter((q) => q.status === "COMPLETED").length,
    },
    queue,
  };
}

/** Mark a consultation finished — the one write a doctor makes here. */
export async function completeConsultation(actor: AuthUser, appointmentId: string): Promise<void> {
  const doc = await doctorForUser(actor);
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { id: true, doctorId: true, status: true },
  });
  if (!appt) throw new ApiError(404, "Appointment not found");
  if (appt.doctorId !== doc.id) throw new ApiError(403, "That isn't your appointment");
  if (appt.status === "COMPLETED") throw new ApiError(400, "Already completed");

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
}

/**
 * Everything a doctor needs on one patient: history, lab results, and the
 * scans of the handwritten prescriptions from previous visits.
 */
export async function doctorPatientChart(actor: AuthUser, displayId: string) {
  await doctorForUser(actor); // any doctor may read a patient chart

  const patient = await prisma.patient.findUnique({
    where: { displayId },
    select: {
      id: true, displayId: true, fullName: true, age: true, dob: true, gender: true,
      bloodGroup: true, phone: true, address: true, city: true,
      occupation: true, remarks: true, isVip: true,
      mergedIntoId: true, deletedAt: true,
    },
  });
  if (!patient || patient.mergedIntoId || patient.deletedAt) throw new ApiError(404, "No patient found with that ID");

  const [visits, labs, scans] = await Promise.all([
    prisma.appointment.findMany({
      where: { patientId: patient.id },
      orderBy: { visitDate: "desc" }, take: 20,
      select: {
        opNumber: true, visitDate: true, status: true,
        doctor: { select: { name: true, department: true } },
      },
    }),
    prisma.labTest.findMany({
      where: { OR: [{ patientId: patient.id }, { appointment: { patientId: patient.id } }] },
      orderBy: { createdAt: "desc" }, take: 30,
      select: { id: true, testName: true, status: true, reportFileUrl: true, createdAt: true, completedAt: true },
    }),
    prisma.prescriptionUpload.findMany({
      where: { patientId: patient.id },
      orderBy: { createdAt: "desc" }, take: 20,
      select: {
        id: true, fileUrl: true, fileName: true, title: true, doctorName: true,
        status: true, createdAt: true,
        appointment: { select: { opNumber: true, visitDate: true, doctor: { select: { name: true } } } },
      },
    }),
  ]);

  return {
    patient: {
      id: patient.id, displayId: patient.displayId, fullName: patient.fullName,
      age: patient.age, gender: patient.gender, bloodGroup: patient.bloodGroup,
      phone: patient.phone, address: patient.address, city: patient.city,
      occupation: patient.occupation, remarks: patient.remarks, isVip: patient.isVip,
    },
    visits: (visits as { opNumber: string; visitDate: Date; status: string; doctor: { name: string; department: string } }[]).map((v) => ({
      opNumber: v.opNumber,
      visitDate: v.visitDate.toISOString().slice(0, 10),
      status: v.status,
      doctorName: v.doctor.name,
      department: v.doctor.department,
    })),
    labs: (labs as { id: string; testName: string; status: string; reportFileUrl: string | null; createdAt: Date; completedAt: Date | null }[]).map((l) => ({
      id: l.id, testName: l.testName, status: l.status, reportFileUrl: l.reportFileUrl,
      createdAt: l.createdAt.toISOString().slice(0, 10),
      completedAt: l.completedAt ? l.completedAt.toISOString().slice(0, 10) : null,
    })),
    /** The scanned handwritten prescriptions — the doctor's own record. */
    prescriptions: (scans as {
      id: string; fileUrl: string; fileName: string; title: string | null; doctorName: string | null;
      status: string; createdAt: Date;
      appointment: { opNumber: string; visitDate: Date; doctor: { name: string } } | null;
    }[]).map((p) => ({
      id: p.id, fileUrl: p.fileUrl, fileName: p.fileName, title: p.title,
      doctorName: p.doctorName ?? p.appointment?.doctor.name ?? null,
      status: p.status,
      createdAt: p.createdAt.toISOString().slice(0, 10),
      visitDate: p.appointment ? p.appointment.visitDate.toISOString().slice(0, 10) : null,
    })),
  };
}

import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { listPatientPrescriptions, type PrescriptionUploadDTO } from "./prescriptions.service";

export interface PatientProfileDTO {
  displayId: string;
  fullName: string;
  firstName: string;
  middleName: string | null;
  lastName: string | null;
  dob: string | null;
  age: number | null;
  gender: string | null;
  bloodGroup: string | null;
  maritalStatus: string | null;
  phone: string;
  alternatePhone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  occupation: string | null;
  nationality: string | null;
  preferredLanguage: string | null;
  memberSince: string;
}

export interface PatientAppointmentDTO {
  opNumber: string;
  visitDate: string;
  time: string;
  status: string;
  doctorName: string;
  department: string;
  price: string;
}

/**
 * The patient's own full profile. NOTE: referral fields are intentionally
 * NOT included — those are admin-only and a patient never sees who referred them.
 */
export async function getPatientProfile(patientId: string): Promise<PatientProfileDTO> {
  const p = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      displayId: true, fullName: true, firstName: true, middleName: true, lastName: true,
      dob: true, age: true, gender: true, bloodGroup: true, maritalStatus: true,
      phone: true, alternatePhone: true, email: true, address: true, city: true,
      state: true, country: true, postalCode: true, occupation: true, nationality: true,
      preferredLanguage: true, createdAt: true,
    },
  });
  if (!p) throw new ApiError(404, "Profile not found");

  return {
    displayId: p.displayId, fullName: p.fullName, firstName: p.firstName,
    middleName: p.middleName, lastName: p.lastName,
    dob: p.dob ? p.dob.toISOString().slice(0, 10) : null,
    age: p.age, gender: p.gender, bloodGroup: p.bloodGroup, maritalStatus: p.maritalStatus,
    phone: p.phone, alternatePhone: p.alternatePhone, email: p.email, address: p.address,
    city: p.city, state: p.state, country: p.country, postalCode: p.postalCode,
    occupation: p.occupation, nationality: p.nationality, preferredLanguage: p.preferredLanguage,
    memberSince: p.createdAt.toISOString().slice(0, 10),
  };
}

/** The patient's appointment history (their own visits). */
export async function getPatientAppointments(patientId: string): Promise<PatientAppointmentDTO[]> {
  const rows = await prisma.appointment.findMany({
    where: { patientId },
    orderBy: { visitDate: "desc" },
    select: {
      id: true, opNumber: true, visitDate: true, status: true, priceAtBooking: true,
      timeAtBooking: true,
      doctor: { select: { name: true, department: true } },
    },
  });
  return rows.map((a: {
    id: string; opNumber: string; visitDate: Date; status: string; priceAtBooking: { toString(): string };
    timeAtBooking: string; doctor: { name: string; department: string };
  }) => ({
    id: a.id,
    opNumber: a.opNumber,
    visitDate: a.visitDate.toISOString().slice(0, 10),
    time: a.timeAtBooking,
    status: a.status,
    doctorName: a.doctor.name,
    department: a.doctor.department,
    price: a.priceAtBooking.toString(),
  }));
}

/** Full bundle for the patient profile page. */
export async function getPatientProfileBundle(patientId: string): Promise<{
  profile: PatientProfileDTO;
  appointments: PatientAppointmentDTO[];
  prescriptions: PrescriptionUploadDTO[];
}> {
  const [profile, appointments, prescriptions] = await Promise.all([
    getPatientProfile(patientId),
    getPatientAppointments(patientId),
    listPatientPrescriptions(patientId),
  ]);
  return { profile, appointments, prescriptions };
}

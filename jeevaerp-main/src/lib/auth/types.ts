export const ROLES = [
  "PATIENT",
  "DOCTOR",
  "RECEPTIONIST",
  "LAB_TECH",
  "PHARMACIST",
  "ADMIN",
] as const;

export type Role = (typeof ROLES)[number];

export interface AuthUser {
  /** User.id for staff, Patient.id when role === "PATIENT" */
  id: string;
  role: Role;
}

import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { nextId } from "@/lib/ids";
import { logAudit } from "./audit.service";
import type { AuthUser } from "@/lib/auth/types";
import type { Prisma, ClaimStatus } from "@prisma/client";

/** The insurers and TPAs a hospital front office deals with most. Editable —
 *  the form also accepts a free-typed name for anything not on the list. */
export const INSURERS = [
  "Star Health", "HDFC ERGO", "ICICI Lombard", "Bajaj Allianz", "Care Health",
  "Niva Bupa", "New India Assurance", "United India Insurance", "Oriental Insurance",
  "National Insurance", "Aditya Birla Health", "Tata AIG", "SBI General",
  "Medi Assist (TPA)", "Paramount TPA", "Health India TPA", "Vidal Health (TPA)",
  "MDIndia (TPA)", "Family Health Plan (TPA)", "Aarogyasri (State scheme)", "CGHS", "ECHS",
] as const;

const money = (d: Prisma.Decimal | null | undefined): string | null =>
  d == null ? null : Number(d).toFixed(2);

export interface ClaimListDTO {
  id: string; claimNo: string;
  patient: { id: string; displayId: string; fullName: string };
  insurer: string; policyNo: string;
  type: string; stage: string; status: string;
  claimedAmount: string; approvedAmount: string | null; settledAmount: string | null;
  insurerRef: string | null;
  createdAt: string; submittedAt: string | null; updatedAt: string;
}

export interface ClaimEventDTO { kind: string; detail: string | null; amount: string | null; by: string; at: string; }

export interface ClaimDetailDTO extends ClaimListDTO {
  patient: { id: string; displayId: string; fullName: string; phone: string; age: number | null };
  memberId: string | null; sumInsured: string | null;
  diagnosis: string | null; remarks: string | null;
  admissionId: string | null; invoiceId: string | null;
  decisionAt: string | null; settledAt: string | null;
  events: ClaimEventDTO[];
}

const listSelect = {
  id: true, claimNo: true, insurer: true, policyNo: true, type: true, stage: true, status: true,
  claimedAmount: true, approvedAmount: true, settledAmount: true, insurerRef: true,
  createdAt: true, submittedAt: true, updatedAt: true,
  patient: { select: { id: true, displayId: true, fullName: true } },
} satisfies Prisma.InsuranceClaimSelect;

function toListDTO(r: Prisma.InsuranceClaimGetPayload<{ select: typeof listSelect }>): ClaimListDTO {
  return {
    id: r.id, claimNo: r.claimNo,
    patient: r.patient,
    insurer: r.insurer, policyNo: r.policyNo,
    type: r.type, stage: r.stage, status: r.status,
    claimedAmount: money(r.claimedAmount)!, approvedAmount: money(r.approvedAmount), settledAmount: money(r.settledAmount),
    insurerRef: r.insurerRef,
    createdAt: r.createdAt.toISOString(), submittedAt: r.submittedAt?.toISOString() ?? null, updatedAt: r.updatedAt.toISOString(),
  };
}

export async function createClaim(
  actor: AuthUser,
  input: {
    patientId: string; insurer: string; policyNo: string; memberId?: string; sumInsured?: number;
    type: "CASHLESS" | "REIMBURSEMENT"; stage: "PRE_AUTH" | "FINAL"; diagnosis?: string;
    claimedAmount: number; admissionId?: string; invoiceId?: string; remarks?: string;
  },
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<ClaimDetailDTO> {
  const patient = await prisma.patient.findUnique({ where: { id: input.patientId }, select: { id: true, mergedIntoId: true } });
  if (!patient || patient.mergedIntoId) throw new ApiError(404, "Patient not found");

  const claim = await prisma.$transaction(async (tx) => {
    const claimNo = await nextId("CLAIM", { tx });
    const created = await tx.insuranceClaim.create({
      data: {
        claimNo,
        patientId: input.patientId,
        admissionId: input.admissionId?.trim() || null,
        invoiceId: input.invoiceId?.trim() || null,
        insurer: input.insurer.trim(),
        policyNo: input.policyNo.trim(),
        memberId: input.memberId?.trim() || null,
        sumInsured: input.sumInsured !== undefined ? input.sumInsured.toFixed(2) : null,
        type: input.type,
        stage: input.stage,
        status: "DRAFT",
        diagnosis: input.diagnosis?.trim() || null,
        claimedAmount: input.claimedAmount.toFixed(2),
        remarks: input.remarks?.trim() || null,
        createdById: actor.id,
        events: { create: { kind: "CREATED", detail: `Claim raised for ${input.insurer}`, byId: actor.id } },
      },
      select: { id: true },
    });
    return created;
  });

  await logAudit(actor, { action: "CLAIM_CREATED", targetTable: "InsuranceClaim", targetId: claim.id, meta: { insurer: input.insurer, amount: input.claimedAmount }, ...ctx });
  return getClaim(claim.id);
}

export async function listClaims(filter: { status?: string; q?: string }): Promise<ClaimListDTO[]> {
  const where: Prisma.InsuranceClaimWhereInput = {};
  if (filter.status && filter.status !== "ALL") {
    if (filter.status === "WITH_INSURER") where.status = { in: ["SUBMITTED", "QUERIED"] };
    else where.status = filter.status as ClaimStatus;
  }
  if (filter.q?.trim()) {
    const q = filter.q.trim();
    where.OR = [
      { claimNo: { contains: q, mode: "insensitive" } },
      { insurer: { contains: q, mode: "insensitive" } },
      { policyNo: { contains: q, mode: "insensitive" } },
      { patient: { fullName: { contains: q, mode: "insensitive" } } },
      { patient: { displayId: { contains: q, mode: "insensitive" } } },
    ];
  }
  const rows = await prisma.insuranceClaim.findMany({ where, orderBy: { createdAt: "desc" }, take: 200, select: listSelect });
  return rows.map(toListDTO);
}

export async function claimStats(): Promise<{
  counts: { draft: number; withInsurer: number; approved: number; settled: number; rejected: number };
  totalClaimed: string; totalApproved: string; totalSettled: string; pendingSettlement: string;
}> {
  const rows = await prisma.insuranceClaim.findMany({
    select: { status: true, claimedAmount: true, approvedAmount: true, settledAmount: true },
  });
  const counts = { draft: 0, withInsurer: 0, approved: 0, settled: 0, rejected: 0 };
  let totalClaimed = 0, totalApproved = 0, totalSettled = 0, pendingSettlement = 0;
  for (const r of rows) {
    const claimed = Number(r.claimedAmount);
    const approved = r.approvedAmount ? Number(r.approvedAmount) : 0;
    const settled = r.settledAmount ? Number(r.settledAmount) : 0;
    totalClaimed += claimed; totalApproved += approved; totalSettled += settled;
    if (r.status === "DRAFT") counts.draft++;
    else if (r.status === "SUBMITTED" || r.status === "QUERIED") counts.withInsurer++;
    else if (r.status === "APPROVED" || r.status === "PARTIALLY_APPROVED") { counts.approved++; pendingSettlement += Math.max(0, approved - settled); }
    else if (r.status === "SETTLED") counts.settled++;
    else if (r.status === "REJECTED") counts.rejected++;
  }
  return {
    counts,
    totalClaimed: totalClaimed.toFixed(2), totalApproved: totalApproved.toFixed(2),
    totalSettled: totalSettled.toFixed(2), pendingSettlement: pendingSettlement.toFixed(2),
  };
}

export async function getClaim(id: string): Promise<ClaimDetailDTO> {
  const r = await prisma.insuranceClaim.findUnique({
    where: { id },
    select: {
      ...listSelect,
      memberId: true, sumInsured: true, diagnosis: true, remarks: true, admissionId: true, invoiceId: true,
      decisionAt: true, settledAt: true,
      patient: { select: { id: true, displayId: true, fullName: true, phone: true, age: true } },
      events: { orderBy: { createdAt: "asc" }, select: { kind: true, detail: true, amount: true, createdAt: true, by: { select: { name: true } } } },
    },
  });
  if (!r) throw new ApiError(404, "Claim not found");
  return {
    ...toListDTO(r as never),
    patient: r.patient,
    memberId: r.memberId, sumInsured: money(r.sumInsured),
    diagnosis: r.diagnosis, remarks: r.remarks, admissionId: r.admissionId, invoiceId: r.invoiceId,
    decisionAt: r.decisionAt?.toISOString() ?? null, settledAt: r.settledAt?.toISOString() ?? null,
    events: r.events.map((e) => ({ kind: e.kind, detail: e.detail, amount: money(e.amount), by: e.by.name, at: e.createdAt.toISOString() })),
  };
}

/** The lifecycle engine. Each action is only valid from certain states, and
 *  every action lands on the timeline. */
export async function actOnClaim(
  actor: AuthUser,
  id: string,
  input: { action: "SUBMIT" | "QUERY" | "APPROVE" | "REJECT" | "SETTLE" | "NOTE"; amount?: number; insurerRef?: string; detail?: string },
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<ClaimDetailDTO> {
  const claim = await prisma.insuranceClaim.findUnique({ where: { id }, select: { id: true, status: true, claimedAmount: true, approvedAmount: true } });
  if (!claim) throw new ApiError(404, "Claim not found");

  const now = new Date();
  const data: Prisma.InsuranceClaimUpdateInput = {};
  // store the timeline entry in past tense so it reads as a history, not a verb
  const KIND: Record<string, string> = { SUBMIT: "SUBMITTED", QUERY: "QUERIED", REJECT: "REJECTED", SETTLE: "SETTLED", NOTE: "NOTE" };
  let kind = KIND[input.action] ?? input.action;
  let eventAmount: number | undefined;
  const allowed = (states: ClaimStatus[]) => { if (!states.includes(claim.status)) throw new ApiError(400, `Can't ${input.action.toLowerCase()} a claim that is ${claim.status.toLowerCase().replace(/_/g, " ")}`); };

  switch (input.action) {
    case "SUBMIT":
      allowed(["DRAFT", "QUERIED"]);
      data.status = "SUBMITTED"; data.submittedAt = now;
      if (input.insurerRef) data.insurerRef = input.insurerRef.trim();
      break;
    case "QUERY":
      allowed(["SUBMITTED"]);
      data.status = "QUERIED";
      break;
    case "APPROVE": {
      allowed(["SUBMITTED", "QUERIED"]);
      const approved = input.amount ?? Number(claim.claimedAmount);
      const partial = approved < Number(claim.claimedAmount);
      data.status = partial ? "PARTIALLY_APPROVED" : "APPROVED";
      data.approvedAmount = approved.toFixed(2); data.decisionAt = now;
      if (input.insurerRef) data.insurerRef = input.insurerRef.trim();
      eventAmount = approved;
      kind = partial ? "PARTIALLY_APPROVED" : "APPROVED";
      break;
    }
    case "REJECT":
      allowed(["SUBMITTED", "QUERIED"]);
      data.status = "REJECTED"; data.decisionAt = now;
      break;
    case "SETTLE": {
      allowed(["APPROVED", "PARTIALLY_APPROVED"]);
      const settled = input.amount ?? (claim.approvedAmount ? Number(claim.approvedAmount) : 0);
      data.status = "SETTLED"; data.settledAmount = settled.toFixed(2); data.settledAt = now;
      eventAmount = settled;
      break;
    }
    case "NOTE":
      if (!input.detail?.trim()) throw new ApiError(400, "Add a note");
      break;
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length) await tx.insuranceClaim.update({ where: { id }, data });
    await tx.claimEvent.create({
      data: { claimId: id, kind, detail: input.detail?.trim() || null, amount: eventAmount !== undefined ? eventAmount.toFixed(2) : null, byId: actor.id },
    });
  });

  await logAudit(actor, { action: `CLAIM_${input.action}`, targetTable: "InsuranceClaim", targetId: id, meta: { amount: input.amount, insurerRef: input.insurerRef }, ...ctx });
  return getClaim(id);
}

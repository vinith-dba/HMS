import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { otpRequestSchema } from "@/server/validators/auth";
import { requestOtp } from "@/server/services/auth.service";

export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const { patientId } = await parseBody(req, otpRequestSchema);
  const { sentTo } = await requestOtp(patientId);
  return NextResponse.json({
    message: `A one-time code has been sent to ${sentTo}.`,
    sentTo,
  });
});

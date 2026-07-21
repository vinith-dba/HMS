import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { staffOtpRequestSchema } from "@/server/validators/auth";
import { requestStaffOtp } from "@/server/services/auth.service";

export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const { username } = await parseBody(req, staffOtpRequestSchema);
  const { sentTo } = await requestStaffOtp(username);
  return NextResponse.json({ message: `A login code was sent to ${sentTo}.`, sentTo });
});

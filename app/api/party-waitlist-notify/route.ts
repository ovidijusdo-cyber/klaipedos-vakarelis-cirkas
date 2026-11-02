import { NextResponse } from "next/server";
import { notifyAvailablePartyWaitlistGuests } from "../../../lib/party-waitlist";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await notifyAvailablePartyWaitlistGuests();
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to process party waitlist", error);
    return NextResponse.json({ error: "Failed to process party waitlist" }, { status: 500 });
  }
}

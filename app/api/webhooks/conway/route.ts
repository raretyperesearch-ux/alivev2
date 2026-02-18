import { NextRequest, NextResponse } from "next/server";
import { handleConwayWebhook } from "@/lib/conway";

/**
 * POST /api/webhooks/conway
 * 
 * Receives heartbeat and event webhooks from Conway automatons.
 * Conway sends these periodically to report agent status, earnings, expenses, etc.
 */
export async function POST(request: NextRequest) {
  // Verify webhook secret
  const secret = request.headers.get("x-conway-secret");
  if (secret !== process.env.CONWAY_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json();

    // Validate payload
    if (!payload.sandbox_id || !payload.event) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    await handleConwayWebhook(payload);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}

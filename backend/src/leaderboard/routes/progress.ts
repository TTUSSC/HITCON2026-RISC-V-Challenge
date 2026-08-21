import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleCorsAndMethod } from "../../shared/http";
import { parseProgressBody } from "../validate";
import { recordProgress } from "../queries";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (handleCorsAndMethod(req, res, "POST")) return;

  const parsed = parseProgressBody(req.body);
  if (!parsed.ok) {
    res.status(400).json({ ok: false, error: parsed.error });
    return;
  }

  try {
    await recordProgress(parsed.value);
    res.status(200).json({ ok: true, depth: parsed.value.depth });
  } catch (error) {
    // Logged for the Vercel dashboard, never echoed — a connection string in
    // an error message must not reach the client.
    console.error("POST /api/leaderboard/progress failed", error);
    res.status(500).json({ ok: false, error: "internal error" });
  }
}

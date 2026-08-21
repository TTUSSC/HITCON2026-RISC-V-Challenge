import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleCorsAndMethod } from "../../shared/http";
import { fetchBestPasses } from "../queries";
import { parseLimit, rankEntries } from "../ranking";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (handleCorsAndMethod(req, res, "GET")) return;

  try {
    const rows = await fetchBestPasses(parseLimit(req.query.limit));
    // A few seconds of edge caching absorbs a big-screen display polling this
    // without making the board feel stale in a booth setting.
    res.setHeader("Cache-Control", "public, s-maxage=5, stale-while-revalidate=15");
    res.status(200).json({
      entries: rankEntries(rows),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("GET /api/leaderboard failed", error);
    res.status(500).json({ error: "internal error" });
  }
}

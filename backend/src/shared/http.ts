import type { VercelRequest, VercelResponse } from "@vercel/node";

// The entire HTTP boilerplate for every endpoint, present and future — this
// one function is why the backend needs no HTTP framework. Routing is already
// Vercel's file-based routes; this is all that is left.
//
// Allow-Origin is "*" because this API is public, carries no cookie and no
// Authorization header, so there is no cross-origin credential to protect. In
// production the frontend reaches it same-origin through a /api/* rewrite
// anyway; these headers only matter when something calls the backend's own
// domain directly (local development, or a big-screen display).
//
// Returns true when it has already answered the request — a preflight or a
// wrong method — so a route's first line is `if (handleCorsAndMethod(...)) return;`
// and nothing else.
export function handleCorsAndMethod(
  req: VercelRequest,
  res: VercelResponse,
  method: "GET" | "POST",
): boolean {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  if (req.method !== method) {
    res.setHeader("Allow", `${method}, OPTIONS`);
    res.status(405).json({ error: `method not allowed, use ${method}` });
    return true;
  }
  return false;
}

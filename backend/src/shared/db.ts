import { neon } from "@neondatabase/serverless";

// Connection only — no feature-specific SQL belongs here. Each feature keeps
// its queries beside the rest of that feature (see src/leaderboard/queries.ts),
// so adding a second feature never touches this file.
//
// The HTTP-based driver is deliberate: a serverless function is torn down
// after each request, so a pooled TCP client would leak connections until the
// database starts refusing new ones. This driver issues each query as a plain
// HTTP call and holds nothing open.

type SqlClient = ReturnType<typeof neon>;

let client: SqlClient | undefined;

export function getSql(): SqlClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!client) {
    client = neon(url);
  }
  return client;
}

import { getSql } from "../shared/db";
import type { EntryPoint, ProgressInput } from "./validate";
import type { BestPassRow } from "./ranking";

// The two statements are not wrapped in a transaction on purpose. The foreign
// key forces player-then-pass ordering, and if the second statement fails the
// worst outcome is a player row with no passes — which the leaderboard's inner
// join simply does not return. Nothing is left visibly inconsistent.
export async function recordProgress(input: ProgressInput): Promise<void> {
  const sql = getSql();

  await sql`
    insert into players (profile_id, display_name, entry_point)
    values (${input.profileId}, ${input.displayName}, ${input.entryPoint})
    on conflict (profile_id) do update
      set display_name = excluded.display_name,
          entry_point  = excluded.entry_point,
          updated_at   = now()
  `;

  // No column is worth updating on a replay: depth is a function of level_id,
  // and passed_at must keep the FIRST clear time because it is the
  // leaderboard's tie-breaker. `do nothing` makes that guarantee structural
  // rather than a matter of which columns happen to be in a SET list.
  await sql`
    insert into passes (profile_id, level_id, depth)
    values (${input.profileId}, ${input.levelId}, ${input.depth})
    on conflict (profile_id, level_id) do nothing
  `;
}

// `distinct on (profile_id)` with a matching `order by` picks each player's
// deepest pass — and, among equally deep passes, the earliest one. No
// denormalised best_depth column to drift out of sync.
export async function fetchBestPasses(limit: number): Promise<BestPassRow[]> {
  const sql = getSql();

  const rows = (await sql`
    with best as (
      select distinct on (profile_id)
             profile_id, depth, level_id, passed_at
      from passes
      order by profile_id, depth desc, passed_at asc
    )
    select p.display_name, p.entry_point, b.depth, b.level_id, b.passed_at
    from best b
    join players p using (profile_id)
    order by b.depth desc, b.passed_at asc
    limit ${limit}
  `) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    displayName: String(row.display_name),
    entryPoint: String(row.entry_point) as EntryPoint,
    depth: Number(row.depth),
    levelId: String(row.level_id),
    passedAt: new Date(String(row.passed_at)),
  }));
}

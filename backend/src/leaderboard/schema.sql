-- Leaderboard feature schema. Apply by hand against the Neon database:
--   psql "$DATABASE_URL" -f src/leaderboard/schema.sql
-- No migration framework by design (see the spec) — the table set is small
-- and the event is one-off.

-- profile_id is TEXT, not UUID, on purpose: frontend/src/engine/profileId.ts
-- falls back to `profile-<timestamp>-<random>` on browsers without
-- crypto.randomUUID, which is not a valid UUID and would fail to insert.
create table if not exists players (
  profile_id   text        primary key,
  display_name text        not null,
  entry_point  text        not null check (entry_point in ('L0', 'L1', 'L2')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- passed_at is written once, by the server, and never updated on a replay —
-- it is the leaderboard's tie-breaker, so re-clearing a level must not push a
-- player down the board.
create table if not exists passes (
  profile_id text        not null references players (profile_id) on delete cascade,
  level_id   text        not null,
  depth      integer     not null check (depth between 1 and 23),
  attempts   integer     not null default 1 check (attempts >= 1),
  passed_at  timestamptz not null default now(),
  primary key (profile_id, level_id)
);

create index if not exists passes_rank_idx on passes (depth desc, passed_at asc);

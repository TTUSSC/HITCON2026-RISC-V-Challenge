import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { LeaderboardPage } from "./LeaderboardPage";

vi.mock("../engine/leaderboardClient", () => ({
  isLeaderboardEnabled: vi.fn(),
  fetchLeaderboard: vi.fn(),
}));

import {
  fetchLeaderboard,
  isLeaderboardEnabled,
} from "../engine/leaderboardClient";

const entry = {
  rank: 1,
  displayName: "阿明",
  entryPoint: "L1" as const,
  depth: 9,
  levelId: "L2-0",
  reachedAt: "2026-08-21T10:00:00.000Z",
};

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("when the leaderboard is not configured", () => {
  beforeEach(() => {
    vi.mocked(isLeaderboardEnabled).mockReturnValue(false);
  });

  it("says so and never calls the API", () => {
    render(<LeaderboardPage />);
    expect(screen.getByText(/尚未啟用/)).toBeDefined();
    expect(fetchLeaderboard).not.toHaveBeenCalled();
  });
});

describe("when the leaderboard is configured", () => {
  beforeEach(() => {
    vi.mocked(isLeaderboardEnabled).mockReturnValue(true);
  });

  it("renders a row per entry, showing the level id rather than the raw depth", async () => {
    vi.mocked(fetchLeaderboard).mockResolvedValue([entry]);
    render(<LeaderboardPage />);
    await waitFor(() => expect(screen.getByText("阿明")).toBeDefined());
    expect(screen.getByText("L2-0")).toBeDefined();
    // "深度 9" would be meaningless to a player — the level id is the label.
    expect(screen.queryByText(/深度/)).toBeNull();
  });

  it("shows an error state rather than an empty board when the request fails", async () => {
    vi.mocked(fetchLeaderboard).mockRejectedValue(new Error("boom"));
    render(<LeaderboardPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
  });

  it("distinguishes an empty board from a failed one", async () => {
    vi.mocked(fetchLeaderboard).mockResolvedValue([]);
    render(<LeaderboardPage />);
    await waitFor(() => expect(screen.getByText(/還沒有人上榜/)).toBeDefined());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows how many players are on the board", async () => {
    vi.mocked(fetchLeaderboard).mockResolvedValue([
      entry,
      { ...entry, rank: 2, displayName: "小美", depth: 6, levelId: "L1-2" },
    ]);
    render(<LeaderboardPage />);
    await waitFor(() => expect(screen.getByText(/共 2 人上榜/)).toBeDefined());
  });
});

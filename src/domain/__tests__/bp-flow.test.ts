import { describe, expect, it } from "vitest";
import {
  applyChampionSelection,
  applyEmptyBan,
  getCompetitiveFlow,
  isChampionUnavailable,
} from "../bp-flow";
import {
  collectPreviousGameSystemBans,
  createGlobalGameSessionState,
  createInitialSessionState,
  getUnavailableChampionIds,
  isBpComplete,
} from "../session-state";

describe("competitive BP flow", () => {
  it("keeps the legacy competitive phase order", () => {
    const flow = getCompetitiveFlow();

    expect(flow.slice(0, 6).map((turn) => turn.side[0].toUpperCase()).join("-")).toBe("B-R-B-R-B-R");
    expect(flow.slice(6, 12).map((turn) => turn.side[0].toUpperCase()).join("-")).toBe("B-R-R-B-B-R");
    expect(flow.slice(12, 16).map((turn) => turn.side[0].toUpperCase()).join("-")).toBe("R-B-R-B");
    expect(flow.slice(16, 20).map((turn) => turn.side[0].toUpperCase()).join("-")).toBe("R-B-B-R");
  });

  it("applies empty bans without making a champion unavailable", () => {
    const initial = {
      ...createInitialSessionState("competitive"),
      pendingChampionId: "Ahri",
    };
    const firstBan = applyEmptyBan(initial, "EmptyBan_test");

    expect(firstBan.ok).toBe(true);
    if (!firstBan.ok) {
      return;
    }

    expect(firstBan.state.blueBans).toEqual(["EmptyBan_test"]);
    expect(firstBan.state.currentStep).toBe(1);
    expect(firstBan.state.whosTurn).toBe("red");
    expect(firstBan.state.pendingChampionId).toBeNull();
    expect(getUnavailableChampionIds(firstBan.state)).toEqual([]);
    expect(isChampionUnavailable(firstBan.state, "Aatrox")).toBe(false);
  });

  it("rejects duplicate champion selections across bans and picks", () => {
    const initial = {
      ...createInitialSessionState("competitive"),
      pendingChampionId: "Ahri",
    };
    const firstBan = applyChampionSelection(initial, "Ahri");

    expect(firstBan.ok).toBe(true);
    if (!firstBan.ok) {
      return;
    }

    expect(firstBan.state.pendingChampionId).toBeNull();
    const duplicateBan = applyChampionSelection(firstBan.state, "Ahri");
    expect(duplicateBan).toEqual({ ok: false, reason: "champion_unavailable" });

    const afterBans = ["Akali", "Ashe", "Azir", "Braum"].reduce((state, championId) => {
      const result = applyChampionSelection(state, championId);
      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error(result.reason);
      }
      return result.state;
    }, firstBan.state);

    const firstPick = applyChampionSelection(afterBans, "Caitlyn");
    expect(firstPick.ok).toBe(true);
    if (!firstPick.ok) {
      return;
    }

    const duplicatePick = applyChampionSelection(firstPick.state, "Caitlyn");
    expect(duplicatePick).toEqual({ ok: false, reason: "champion_unavailable" });
  });

  it("finishes after the twentieth competitive action", () => {
    const championIds = Array.from({ length: 20 }, (_, index) => `Champion${index + 1}`);
    const finalState = championIds.reduce((state, championId) => {
      const result = applyChampionSelection(state, championId);
      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error(result.reason);
      }
      return result.state;
    }, createInitialSessionState("competitive"));

    expect(finalState.currentStep).toBe(20);
    expect(finalState.currentPhase).toBe("finished");
    expect(finalState.whosTurn).toBe("");
    expect(finalState.actionType).toBe("");
    expect(isBpComplete(finalState)).toBe(true);
  });
});

describe("global BP system bans", () => {
  it("system-bans all prior game picks for later global games", () => {
    const previousGames = {
      1: { blue: ["Ahri", "Akali"], red: ["Ashe", "Braum"] },
      2: { blue: ["Caitlyn", "EmptyBan_old"], red: ["Darius", "Ahri"] },
      3: ["Ezreal", "Fiora"],
    };

    expect(collectPreviousGameSystemBans(previousGames, 3)).toEqual([
      "Ahri",
      "Akali",
      "Ashe",
      "Braum",
      "Caitlyn",
      "Darius",
    ]);

    const gameThree = createGlobalGameSessionState(3, previousGames);
    expect(gameThree.systemBannedChampions).toEqual([
      "Ahri",
      "Akali",
      "Ashe",
      "Braum",
      "Caitlyn",
      "Darius",
    ]);
    expect(isChampionUnavailable(gameThree, "Ahri")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { getBpTurn } from "../bp-flow";
import { canRoleActOnTurn, canRoleUseRefereeSystemBan, getRolePermissions } from "../permissions";
import type { UserRole } from "../types";

describe("role permissions", () => {
  it("matches legacy turn permissions for active BP turns", () => {
    const blueTurn = getBpTurn("competitive", 0);
    const redTurn = getBpTurn("competitive", 1);

    expect(canRoleActOnTurn("host", blueTurn)).toBe(true);
    expect(canRoleActOnTurn("referee", blueTurn)).toBe(true);
    expect(canRoleActOnTurn("observer", blueTurn)).toBe(false);
    expect(canRoleActOnTurn("blue", blueTurn)).toBe(true);
    expect(canRoleActOnTurn("red", blueTurn)).toBe(false);
    expect(canRoleActOnTurn("red", redTurn)).toBe(true);
    expect(canRoleActOnTurn("blue", redTurn)).toBe(false);
  });

  it("does not allow any role to act after BP is finished", () => {
    const finishedTurn = getBpTurn("competitive", 20);
    const roles: UserRole[] = ["host", "blue", "red", "observer", "referee"];

    expect(roles.map((role) => canRoleActOnTurn(role, finishedTurn))).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("limits system ban toggles to referees", () => {
    expect(canRoleUseRefereeSystemBan("referee")).toBe(true);
    expect(canRoleUseRefereeSystemBan("host")).toBe(false);
    expect(canRoleUseRefereeSystemBan("blue")).toBe(false);
    expect(canRoleUseRefereeSystemBan("red")).toBe(false);
    expect(canRoleUseRefereeSystemBan("observer")).toBe(false);
  });

  it("returns explicit capability snapshots for UI and API callers", () => {
    expect(getRolePermissions("blue", getBpTurn("competitive", 0))).toEqual({
      canActOnTurn: true,
      canConfirmSelection: true,
      canUseRefereeSystemBan: false,
      canObserve: true,
    });
  });
});

import type { BpTurn, UserRole } from "./types";

export function canRoleActOnTurn(role: UserRole, turn: BpTurn): boolean {
  if (turn.phase === "finished") {
    return false;
  }

  if (role === "host" || role === "referee") {
    return true;
  }

  if (role === "observer") {
    return false;
  }

  return role === turn.side;
}

export function canRoleConfirmSelection(role: UserRole, turn: BpTurn): boolean {
  return canRoleActOnTurn(role, turn);
}

export function canRoleUseRefereeSystemBan(role: UserRole): boolean {
  return role === "referee";
}

export function getRolePermissions(role: UserRole, turn: BpTurn) {
  return {
    canActOnTurn: canRoleActOnTurn(role, turn),
    canConfirmSelection: canRoleConfirmSelection(role, turn),
    canUseRefereeSystemBan: canRoleUseRefereeSystemBan(role),
    canObserve: true,
  };
}

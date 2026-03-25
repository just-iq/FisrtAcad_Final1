import { api, setToken, clearToken } from "./api";
import { resetSocket } from "./socket";

export type Department = {
  id: number | string;
  name: string;
};

export type Level = {
  id: number | string;
  name: string;
};

export type Group = {
  id: number | string;
  name: string;
};

export type AuthUser = {
  id: string;
  email: string;
  full_name: string;
  roles: string[];

  // Flat IDs — derived from nested objects below, stored for convenient access across pages
  department_id?: string | null;
  level_id?: string | null;
  group_id?: string | null;

  department?: Department | null;
  level?: Level | null;
  group?: Group | null;
};

export function getAuthUser(): AuthUser | null {
  const raw = localStorage.getItem("auth_user");
  if (!raw) return null;

  try {
    const user = JSON.parse(raw) as AuthUser;
    // Back-fill flat IDs in case this was stored before the normalization was added
    if (user.department_id == null && user.department?.id != null) {
      user.department_id = String(user.department.id);
    }
    if (user.level_id == null && user.level?.id != null) {
      user.level_id = String(user.level.id);
    }
    if (user.group_id == null && user.group?.id != null) {
      user.group_id = String(user.group.id);
    }
    return user;
  } catch {
    return null;
  }
}

export function setAuthUser(user: AuthUser) {
  localStorage.setItem("auth_user", JSON.stringify(user));
}

export function logout() {
  clearToken();
  localStorage.removeItem("auth_user");
  localStorage.removeItem("currentRole");
  resetSocket();
}

export async function login(email: string, password: string) {
  const res = await api.login(email, password);

  setToken(res.access_token);

  // Normalize: extract flat IDs from nested objects so every page can use user.department_id etc.
  const user: AuthUser = {
    ...res.user,
    department_id: (res.user.department?.id as string) ?? null,
    level_id: (res.user.level?.id as string) ?? null,
    group_id: (res.user.group?.id as string) ?? null,
  };

  setAuthUser(user);
  return user;
}

export function primaryRole(roles: string[]): string {
  if (roles.includes("ADMIN")) return "ADMIN";
  if (roles.includes("LECTURER")) return "LECTURER";
  if (roles.includes("STUDENT_EXEC")) return "STUDENT_EXEC";
  if (roles.includes("COURSE_REP")) return "COURSE_REP";

  return "STUDENT";
}
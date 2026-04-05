import api, { clearApiSessionState } from "@/lib/api";

export type AuthedUser = {
  id?: number;
  email?: string | null;
  username?: string;
  role: string;
} | null;

type MeResponse = {
  school?: {
    id: number;
    slug: string;
    name: string;
  } | null;
  user?: AuthedUser;
};

export async function fetchMe(): Promise<AuthedUser> {
  try {
    const res = await api.get("/auth/me");
    const data = res.data as MeResponse;
    return data?.user ?? null;
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
  } finally {
    clearApiSessionState();
  }
}
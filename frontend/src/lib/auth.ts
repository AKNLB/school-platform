export type AuthedUser = {
  email?: string;
  username?: string;
  role: string;
} | null;

export async function fetchMe(): Promise<AuthedUser> {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:1994";
  const res = await fetch(`${apiBase}/api/auth/me`, { credentials: "include" });
  if (!res.ok) return null;

  const data = await res.json().catch(() => null);
  return data?.user ?? null;
}
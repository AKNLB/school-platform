export type AuthedUser = { email: string; role: string } | null;

export async function fetchMe(): Promise<AuthedUser> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) return null;

  const data = await res.json().catch(() => null);
  return data?.user ?? null;
}

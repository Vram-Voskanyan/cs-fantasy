import "server-only";
import { notFound } from "next/navigation";
import { getSession } from "./session";

/** Admin pages and actions: users with role "admin" only. Others get a 404. */
export async function requireAdmin() {
  const session = await getSession();
  if (!session || (session.user as { role?: string }).role !== "admin") notFound();
  return session;
}

export async function isAdmin() {
  const session = await getSession();
  return (session?.user as { role?: string } | undefined)?.role === "admin";
}

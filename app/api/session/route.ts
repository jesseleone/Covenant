// Persona sign-in. GET returns the signed-in user id and the personas to pick
// from; POST signs in as one; DELETE signs out.

import { cookies } from "next/headers";
import { pool } from "@/lib/server/db";
import { SESSION_COOKIE, currentUserId } from "@/lib/server/session";

export async function GET() {
  const { rows } = await pool().query("SELECT id, name, email, role, title, initials FROM app_user ORDER BY seq");
  return Response.json({ userId: await currentUserId(), users: rows });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId : "";
  const { rows } = await pool().query("SELECT 1 FROM app_user WHERE id = $1", [userId]);
  if (!rows.length) return Response.json({ error: "unknown_user", message: "No such user." }, { status: 400 });
  (await cookies()).set(SESSION_COOKIE, userId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return Response.json({ userId });
}

export async function DELETE() {
  (await cookies()).delete(SESSION_COOKIE);
  return Response.json({ userId: null });
}

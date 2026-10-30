// The signed-in persona. Sign-in is a persona picker (no passwords); the
// chosen user id is kept in an http-only cookie and checked on every request.
// Server-only.

import { cookies } from "next/headers";
import { pool } from "@/lib/server/db";

export const SESSION_COOKIE = "covenant_user";

/** The signed-in user's id, if the cookie names a real user. */
export async function currentUserId(): Promise<string | null> {
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!id) return null;
  const { rows } = await pool().query("SELECT 1 FROM app_user WHERE id = $1", [id]);
  return rows.length ? id : null;
}

export const unauthorized = () => Response.json({ error: "not_signed_in", message: "Sign in first." }, { status: 401 });

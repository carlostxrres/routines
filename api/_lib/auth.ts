import type { VercelRequest } from "@vercel/node";
import { supabaseAdmin } from "./supabaseAdmin.js";

export class UnauthorizedError extends Error {}

// The app is single-user: we only need to know the request carries a valid
// Supabase session, not who "the user" is for scoping data.
export async function requireUser(req: VercelRequest) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  if (!token) {
    throw new UnauthorizedError("Missing bearer token");
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    throw new UnauthorizedError("Invalid or expired token");
  }
  return data.user;
}

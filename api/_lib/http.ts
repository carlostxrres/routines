import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ZodError } from "zod";
import { requireUser, UnauthorizedError } from "./auth.js";

type Method = "GET" | "POST" | "DELETE" | "PATCH";
type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>;

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

// Parses an optional `?limit=` query param for list endpoints, clamped to a
// sane range so a client can't force an unbounded query.
export function parseLimit(raw: unknown, fallback = DEFAULT_LIST_LIMIT): number {
  const value = typeof raw === "string" ? Number(raw) : Number.NaN;
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.min(Math.trunc(value), MAX_LIST_LIMIT);
}

// Wraps a Vercel function with the auth guard, method dispatch, and a single
// place to turn thrown errors into HTTP responses.
export function createHandler(methods: Partial<Record<Method, Handler>>) {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      if (req.method !== "GET") {
        await requireUser(req);
      }

      const handler = methods[req.method as Method];
      if (!handler) {
        res.setHeader("Allow", Object.keys(methods).join(", "));
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      await handler(req, res);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        res.status(401).json({ error: error.message });
        return;
      }
      if (error instanceof ZodError) {
        res.status(400).json({ error: "Validation error", issues: error.issues });
        return;
      }
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}

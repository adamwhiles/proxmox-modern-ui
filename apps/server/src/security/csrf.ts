import type { FastifyRequest } from "fastify";
import { timingSafeEqual } from "./crypto.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Synchronizer-token (double-submit) CSRF check for cookie-authenticated, state-changing requests.
 * The token was handed to the SPA in a readable cookie at login and must be echoed as a header —
 * a cross-site form post or <img> tag cannot read cookies to do that, so this defeats CSRF even
 * though the session cookie itself rides along automatically.
 */
export function requiresCsrfCheck(request: FastifyRequest): boolean {
  return !SAFE_METHODS.has(request.method);
}

export function verifyCsrf(request: FastifyRequest): boolean {
  if (!request.session) return true; // no session yet (e.g. login) — nothing to forge
  const header = request.headers["x-csrf-token"];
  if (typeof header !== "string") return false;
  return timingSafeEqual(header, request.session.csrfToken);
}

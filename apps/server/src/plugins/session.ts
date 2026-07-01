import type { FastifyInstance, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import cookie from "@fastify/cookie";
import { config } from "../config.js";
import { createSession, destroySession, getSession, updateSession, type SessionData } from "../security/sessionStore.js";

const SESSION_COOKIE = "sid";
const CSRF_COOKIE = "csrf_token";

declare module "fastify" {
  interface FastifyRequest {
    session: SessionData | null;
    sessionId: string | null;
  }
  interface FastifyReply {
    startSession(data: Omit<SessionData, "csrfToken">): SessionData;
    saveSession(data: SessionData): void;
    endSession(): void;
  }
}

export default fp(async function sessionPlugin(fastify: FastifyInstance) {
  await fastify.register(cookie, { secret: config.cookieSecret });

  fastify.decorateRequest("session", null);
  fastify.decorateRequest("sessionId", null);

  fastify.addHook("onRequest", async (request, reply) => {
    request.session = null;
    request.sessionId = null;

    const raw = request.cookies[SESSION_COOKIE];
    if (!raw) return;
    const unsigned = request.unsignCookie(raw);
    if (!unsigned.valid || !unsigned.value) {
      reply.clearCookie(SESSION_COOKIE, { path: "/" });
      return;
    }
    const data = getSession(unsigned.value);
    if (!data) {
      reply.clearCookie(SESSION_COOKIE, { path: "/" });
      return;
    }
    request.session = data;
    request.sessionId = unsigned.value;
  });

  fastify.decorateReply("startSession", function (this: FastifyReply, initial: Omit<SessionData, "csrfToken">) {
    const { id, data } = createSession(initial);
    this.setCookie(SESSION_COOKIE, id, {
      path: "/",
      httpOnly: true,
      secure: config.tlsTerminated,
      sameSite: "strict",
      signed: true,
    });
    // Double-submit CSRF cookie: intentionally NOT httpOnly so the SPA can read and echo it as a header.
    this.setCookie(CSRF_COOKIE, data.csrfToken, {
      path: "/",
      httpOnly: false,
      secure: config.tlsTerminated,
      sameSite: "strict",
    });
    this.request.session = data;
    this.request.sessionId = id;
    return data;
  });

  fastify.decorateReply("saveSession", function (this: FastifyReply, data: SessionData) {
    if (!this.request.sessionId) throw new Error("No active session to save");
    updateSession(this.request.sessionId, data);
    this.request.session = data;
  });

  fastify.decorateReply("endSession", function (this: FastifyReply) {
    if (this.request.sessionId) destroySession(this.request.sessionId);
    this.clearCookie(SESSION_COOKIE, { path: "/" });
    this.clearCookie(CSRF_COOKIE, { path: "/" });
    this.request.session = null;
    this.request.sessionId = null;
  });
});

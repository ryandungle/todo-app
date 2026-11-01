import { and, eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import type { MemberRole, RoomEvent } from "../shared/schemas";
import { getAuth, type Bindings, type Db, type Session } from "./auth";
import { list, listMember } from "./schema";

export type Env = {
  Bindings: Bindings;
  Variables: {
    db: Db;
    session: Session;
    list: typeof list.$inferSelect;
    role: MemberRole;
  };
};

export const requireSession = createMiddleware<Env>(async (c, next) => {
  const { auth, drizzle } = getAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  c.set("db", drizzle);
  c.set("session", session);
  await next();
});

/** Loads the list from the `:listId` param and checks the caller is a member (optionally with a given role). */
export const requireList = (role?: MemberRole) =>
  createMiddleware<Env>(async (c, next) => {
    const listId = c.req.param("listId");
    if (!listId) return c.json({ error: "Missing list id" }, 400);
    const userId = c.get("session").user.id;

    const [row] = await c
      .get("db")
      .select({ list, role: listMember.role })
      .from(listMember)
      .innerJoin(list, eq(list.id, listMember.listId))
      .where(and(eq(listMember.listId, listId), eq(listMember.userId, userId)))
      .limit(1);

    if (!row) return c.json({ error: "Not found" }, 404);
    if (role && row.role !== role) return c.json({ error: "Forbidden" }, 403);

    c.set("list", row.list);
    c.set("role", row.role);
    await next();
  });

/** Fan out a change notification to everyone connected to the list's room. Fire-and-forget. */
export function notifyRoom(
  env: Bindings,
  executionCtx: { waitUntil(promise: Promise<unknown>): void },
  event: RoomEvent,
): void {
  const stub = env.LIST_ROOM.get(env.LIST_ROOM.idFromName(event.listId));
  executionCtx.waitUntil(stub.broadcast(event).catch(() => undefined));
}

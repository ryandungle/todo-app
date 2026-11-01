import { zValidator } from "@hono/zod-validator";
import { and, count, desc, eq, ne, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { Hono } from "hono";
import {
  addMemberSchema,
  createListSchema,
  createTodoSchema,
  moveTodoSchema,
  updateListSchema,
  updateTodoSchema,
  type Collaborators,
  type List,
  type Member,
  type Overview,
  type Todo,
} from "../shared/schemas";
import { createPersonalList, type Db } from "./auth";
import { notifyRoom, requireList, requireSession, type Env } from "./middleware";
import { list, listMember, todos, user } from "./schema";

const creator = alias(user, "creator");
const completer = alias(user, "completer");
const myMembership = alias(listMember, "my_membership");

/** Todos with creator/completer names resolved. `where` is combined with the caller's scope. */
function selectTodos(db: Db, where: SQL | undefined) {
  return db
    .select({
      id: todos.id,
      listId: todos.listId,
      title: todos.title,
      completed: todos.completed,
      createdAt: todos.createdAt,
      completedAt: todos.completedAt,
      createdById: creator.id,
      createdByName: creator.name,
      completedById: completer.id,
      completedByName: completer.name,
      listName: list.name,
    })
    .from(todos)
    .innerJoin(list, eq(list.id, todos.listId))
    .leftJoin(creator, eq(creator.id, todos.createdBy))
    .leftJoin(completer, eq(completer.id, todos.completedBy))
    .where(where)
    .orderBy(desc(todos.createdAt));
}

type TodoRow = Awaited<ReturnType<typeof selectTodos>>[number];

const toTodo = (row: TodoRow): Todo & { listId: string } => ({
  id: row.id,
  listId: row.listId,
  title: row.title,
  completed: row.completed,
  createdAt: row.createdAt,
  createdBy: row.createdById ? { id: row.createdById, name: row.createdByName ?? "" } : null,
  completedBy: row.completedById ? { id: row.completedById, name: row.completedByName ?? "" } : null,
  completedAt: row.completedAt,
});

export const lists = new Hono<Env>()
  .use("*", requireSession)

  // ----- Lists -----------------------------------------------------------
  .get("/", async (c) => {
    const db = c.get("db");
    const userId = c.get("session").user.id;

    const memberCounts = db
      .select({ listId: listMember.listId, memberCount: count().as("member_count") })
      .from(listMember)
      .groupBy(listMember.listId)
      .as("mc");

    const query = () =>
      db
        .select({
          id: list.id,
          name: list.name,
          ownerId: list.ownerId,
          createdAt: list.createdAt,
          role: listMember.role,
          memberCount: sql<number>`coalesce(${memberCounts.memberCount}, 0)`,
        })
        .from(listMember)
        .innerJoin(list, eq(list.id, listMember.listId))
        .leftJoin(memberCounts, eq(memberCounts.listId, list.id))
        .where(eq(listMember.userId, userId))
        .orderBy(list.createdAt);

    let rows = await query();
    if (rows.length === 0) {
      await createPersonalList(db, userId);
      rows = await query();
    }
    return c.json(rows satisfies List[]);
  })
  // All todos across every list the caller belongs to (for the aggregated dashboard).
  .get("/overview", async (c) => {
    const db = c.get("db");
    const userId = c.get("session").user.id;
    const myLists = db
      .select({ listId: listMember.listId })
      .from(listMember)
      .where(eq(listMember.userId, userId));
    const rows = await selectTodos(db, sql`${todos.listId} IN ${myLists}`);
    return c.json({ todos: rows.map((row) => ({ ...toTodo(row), listName: row.listName })) } satisfies Overview);
  })
  // Everyone the caller shares at least one list with (for share-panel suggestions).
  .get("/collaborators", async (c) => {
    const db = c.get("db");
    const userId = c.get("session").user.id;
    const rows = await db
      .selectDistinct({ id: user.id, name: user.name, email: user.email })
      .from(myMembership)
      .innerJoin(listMember, eq(listMember.listId, myMembership.listId))
      .innerJoin(user, eq(user.id, listMember.userId))
      .where(and(eq(myMembership.userId, userId), ne(listMember.userId, userId)))
      .orderBy(user.name);
    return c.json({ collaborators: rows } satisfies Collaborators);
  })
  .post("/", zValidator("json", createListSchema), async (c) => {
    const db = c.get("db");
    const userId = c.get("session").user.id;
    const { name } = c.req.valid("json");
    const now = Date.now();
    const id = crypto.randomUUID();
    await db.batch([
      db.insert(list).values({ id, name, ownerId: userId, createdAt: now }),
      db.insert(listMember).values({ listId: id, userId, role: "owner", createdAt: now }),
    ]);
    const created: List = { id, name, ownerId: userId, role: "owner", memberCount: 1, createdAt: now };
    return c.json(created, 201);
  })
  .patch("/:listId", requireList("owner"), zValidator("json", updateListSchema), async (c) => {
    const { name } = c.req.valid("json");
    const listId = c.get("list").id;
    await c.get("db").update(list).set({ name }).where(eq(list.id, listId));
    notifyRoom(c.env, c.executionCtx, { type: "list", listId });
    return c.json({ ok: true });
  })
  .delete("/:listId", requireList("owner"), async (c) => {
    const listId = c.get("list").id;
    await c.get("db").delete(list).where(eq(list.id, listId));
    notifyRoom(c.env, c.executionCtx, { type: "list", listId });
    return c.body(null, 204);
  })

  // ----- Members ---------------------------------------------------------
  .get("/:listId/members", requireList(), async (c) => {
    const rows = await c
      .get("db")
      .select({ userId: user.id, name: user.name, email: user.email, role: listMember.role })
      .from(listMember)
      .innerJoin(user, eq(user.id, listMember.userId))
      .where(eq(listMember.listId, c.get("list").id))
      .orderBy(listMember.createdAt);
    return c.json(rows satisfies Member[]);
  })
  .post("/:listId/members", requireList("owner"), zValidator("json", addMemberSchema), async (c) => {
    const db = c.get("db");
    const listId = c.get("list").id;
    const { email } = c.req.valid("json");

    const [target] = await db
      .select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .where(eq(user.email, email.toLowerCase()))
      .limit(1);
    if (!target) return c.json({ error: "No account with that email" }, 404);

    const [existing] = await db
      .select({ userId: listMember.userId })
      .from(listMember)
      .where(and(eq(listMember.listId, listId), eq(listMember.userId, target.id)))
      .limit(1);
    if (existing) return c.json({ error: "Already a member" }, 409);

    await db
      .insert(listMember)
      .values({ listId, userId: target.id, role: "editor", createdAt: Date.now() });
    notifyRoom(c.env, c.executionCtx, { type: "members", listId });

    const member: Member = { userId: target.id, name: target.name, email: target.email, role: "editor" };
    return c.json(member, 201);
  })
  .delete("/:listId/members/:userId", requireList(), async (c) => {
    const listId = c.get("list").id;
    const targetId = c.req.param("userId");
    const me = c.get("session").user.id;

    // Owners can remove anyone except themselves; editors can only leave.
    const isSelf = targetId === me;
    if (c.get("role") !== "owner" && !isSelf) return c.json({ error: "Forbidden" }, 403);
    if (isSelf && c.get("role") === "owner") {
      return c.json({ error: "Owners can't leave their own list; delete it instead" }, 400);
    }

    const deleted = await c
      .get("db")
      .delete(listMember)
      .where(and(eq(listMember.listId, listId), eq(listMember.userId, targetId)))
      .returning({ userId: listMember.userId });
    if (deleted.length === 0) return c.json({ error: "Not found" }, 404);

    notifyRoom(c.env, c.executionCtx, { type: "members", listId });
    return c.body(null, 204);
  })

  // ----- Todos -----------------------------------------------------------
  .get("/:listId/todos", requireList(), async (c) => {
    const rows = await selectTodos(c.get("db"), eq(todos.listId, c.get("list").id));
    return c.json(rows.map(toTodo));
  })
  .post("/:listId/todos", requireList(), zValidator("json", createTodoSchema), async (c) => {
    const listId = c.get("list").id;
    const me = c.get("session").user;
    const { title } = c.req.valid("json");
    const row: typeof todos.$inferInsert = {
      id: crypto.randomUUID(),
      listId,
      title,
      completed: false,
      createdAt: Date.now(),
      createdBy: me.id,
    };
    await c.get("db").insert(todos).values(row);
    notifyRoom(c.env, c.executionCtx, { type: "todos", listId });
    const created: Todo = {
      id: row.id,
      title,
      completed: false,
      createdAt: row.createdAt,
      createdBy: { id: me.id, name: me.name },
      completedBy: null,
      completedAt: null,
    };
    return c.json(created, 201);
  })
  .patch("/:listId/todos/:todoId", requireList(), zValidator("json", updateTodoSchema), async (c) => {
    const db = c.get("db");
    const listId = c.get("list").id;
    const todoId = c.req.param("todoId");
    const me = c.get("session").user;
    const patch = c.req.valid("json");

    // Completing stamps who did it; un-completing clears the stamp.
    const attribution =
      patch.completed === undefined
        ? {}
        : patch.completed
          ? { completedBy: me.id, completedAt: Date.now() }
          : { completedBy: null, completedAt: null };

    const updated = await db
      .update(todos)
      .set({ ...patch, ...attribution })
      .where(and(eq(todos.id, todoId), eq(todos.listId, listId)))
      .returning({ id: todos.id });
    if (updated.length === 0) return c.json({ error: "Not found" }, 404);

    notifyRoom(c.env, c.executionCtx, { type: "todos", listId });
    const [row] = await selectTodos(db, eq(todos.id, todoId));
    return c.json(toTodo(row));
  })
  // Editors can move a todo between any two lists they belong to.
  .post("/:listId/todos/:todoId/move", requireList(), zValidator("json", moveTodoSchema), async (c) => {
    const db = c.get("db");
    const listId = c.get("list").id;
    const todoId = c.req.param("todoId");
    const userId = c.get("session").user.id;
    const { toListId } = c.req.valid("json");

    if (toListId !== listId) {
      const [target] = await db
        .select({ userId: listMember.userId })
        .from(listMember)
        .where(and(eq(listMember.listId, toListId), eq(listMember.userId, userId)))
        .limit(1);
      if (!target) return c.json({ error: "Not found" }, 404);

      const moved = await db
        .update(todos)
        .set({ listId: toListId })
        .where(and(eq(todos.id, todoId), eq(todos.listId, listId)))
        .returning({ id: todos.id });
      if (moved.length === 0) return c.json({ error: "Not found" }, 404);

      notifyRoom(c.env, c.executionCtx, { type: "todos", listId });
      notifyRoom(c.env, c.executionCtx, { type: "todos", listId: toListId });
    }

    const [row] = await selectTodos(db, and(eq(todos.id, todoId), eq(todos.listId, toListId)));
    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json(toTodo(row));
  })
  .delete("/:listId/todos/:todoId", requireList(), async (c) => {
    const listId = c.get("list").id;
    const todoId = c.req.param("todoId");
    const deleted = await c
      .get("db")
      .delete(todos)
      .where(and(eq(todos.id, todoId), eq(todos.listId, listId)))
      .returning({ id: todos.id });
    if (deleted.length === 0) return c.json({ error: "Not found" }, 404);
    notifyRoom(c.env, c.executionCtx, { type: "todos", listId });
    return c.body(null, 204);
  })
  .delete("/:listId/todos", requireList(), async (c) => {
    const listId = c.get("list").id;
    await c
      .get("db")
      .delete(todos)
      .where(and(eq(todos.listId, listId), eq(todos.completed, true)));
    notifyRoom(c.env, c.executionCtx, { type: "todos", listId });
    return c.body(null, 204);
  })

  // ----- Realtime --------------------------------------------------------
  .get("/:listId/ws", requireList(), (c) => {
    const listId = c.get("list").id;
    const stub = c.env.LIST_ROOM.get(c.env.LIST_ROOM.idFromName(listId));
    return stub.fetch(c.req.raw);
  });

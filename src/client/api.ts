import { hc } from "hono/client";
import {
  authConfigSchema,
  collaboratorsSchema,
  listArraySchema,
  listSchema,
  memberArraySchema,
  memberSchema,
  overviewSchema,
  todoListSchema,
  todoSchema,
  type AuthConfig,
  type Collaborator,
  type CreateTodoInput,
  type List,
  type Member,
  type Overview,
  type Todo,
  type UpdateTodoInput,
} from "../shared/schemas";
import type { ApiType } from "../worker/index";

const client = hc<ApiType>("/");

async function fail(res: { json(): Promise<unknown> }, fallback: string): Promise<never> {
  const body = await res.json().catch(() => null);
  const message =
    body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error
      : fallback;
  throw new Error(message);
}

export const api = {
  async config(): Promise<AuthConfig> {
    const res = await client.api.config.$get();
    if (!res.ok) return fail(res, "Failed to load config");
    return authConfigSchema.parse(await res.json());
  },

  account: {
    async setPassword(newPassword: string): Promise<void> {
      const res = await client.api.account.password.$post({ json: { newPassword } });
      if (!res.ok) return fail(res, "Failed to set password");
    },
  },

  lists: {
    async list(): Promise<List[]> {
      const res = await client.api.lists.$get();
      if (!res.ok) return fail(res, "Failed to load lists");
      return listArraySchema.parse(await res.json());
    },
    async overview(): Promise<Overview> {
      const res = await client.api.lists.overview.$get();
      if (!res.ok) return fail(res, "Failed to load overview");
      return overviewSchema.parse(await res.json());
    },
    async collaborators(): Promise<Collaborator[]> {
      const res = await client.api.lists.collaborators.$get();
      if (!res.ok) return fail(res, "Failed to load suggestions");
      return collaboratorsSchema.parse(await res.json()).collaborators;
    },
    async create(name: string): Promise<List> {
      const res = await client.api.lists.$post({ json: { name } });
      if (!res.ok) return fail(res, "Failed to create list");
      return listSchema.parse(await res.json());
    },
    async rename(listId: string, name: string): Promise<void> {
      const res = await client.api.lists[":listId"].$patch({ param: { listId }, json: { name } });
      if (!res.ok) return fail(res, "Failed to rename list");
    },
    async remove(listId: string): Promise<void> {
      const res = await client.api.lists[":listId"].$delete({ param: { listId } });
      if (!res.ok) return fail(res, "Failed to delete list");
    },
  },

  members: {
    async list(listId: string): Promise<Member[]> {
      const res = await client.api.lists[":listId"].members.$get({ param: { listId } });
      if (!res.ok) return fail(res, "Failed to load members");
      return memberArraySchema.parse(await res.json());
    },
    async add(listId: string, email: string): Promise<Member> {
      const res = await client.api.lists[":listId"].members.$post({
        param: { listId },
        json: { email },
      });
      if (!res.ok) return fail(res, "Failed to add member");
      return memberSchema.parse(await res.json());
    },
    async remove(listId: string, userId: string): Promise<void> {
      const res = await client.api.lists[":listId"].members[":userId"].$delete({
        param: { listId, userId },
      });
      if (!res.ok) return fail(res, "Failed to remove member");
    },
  },

  todos: {
    async list(listId: string): Promise<Todo[]> {
      const res = await client.api.lists[":listId"].todos.$get({ param: { listId } });
      if (!res.ok) return fail(res, "Failed to load todos");
      return todoListSchema.parse(await res.json());
    },
    async create(listId: string, input: CreateTodoInput): Promise<Todo> {
      const res = await client.api.lists[":listId"].todos.$post({ param: { listId }, json: input });
      if (!res.ok) return fail(res, "Failed to create todo");
      return todoSchema.parse(await res.json());
    },
    async update(listId: string, todoId: string, patch: UpdateTodoInput): Promise<Todo> {
      const res = await client.api.lists[":listId"].todos[":todoId"].$patch({
        param: { listId, todoId },
        json: patch,
      });
      if (!res.ok) return fail(res, "Failed to update todo");
      return todoSchema.parse(await res.json());
    },
    async move(listId: string, todoId: string, toListId: string): Promise<Todo> {
      const res = await client.api.lists[":listId"].todos[":todoId"].move.$post({
        param: { listId, todoId },
        json: { toListId },
      });
      if (!res.ok) return fail(res, "Failed to move todo");
      return todoSchema.parse(await res.json());
    },
    async remove(listId: string, todoId: string): Promise<void> {
      const res = await client.api.lists[":listId"].todos[":todoId"].$delete({
        param: { listId, todoId },
      });
      if (!res.ok) return fail(res, "Failed to delete todo");
    },
    async clearCompleted(listId: string): Promise<void> {
      const res = await client.api.lists[":listId"].todos.$delete({ param: { listId } });
      if (!res.ok) return fail(res, "Failed to clear completed todos");
    },
  },
};

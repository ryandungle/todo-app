import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Actor, List, Overview, Todo, UpdateTodoInput } from "../shared/schemas";
import { api } from "./api";

export const keys = {
  lists: ["lists"] as const,
  overview: ["overview"] as const,
  collaborators: ["collaborators"] as const,
  todos: (listId: string) => ["lists", listId, "todos"] as const,
  members: (listId: string) => ["lists", listId, "members"] as const,
};

export function useOverview() {
  const query = useQuery({ queryKey: keys.overview, queryFn: api.lists.overview });
  return { todos: query.data?.todos ?? [], isPending: query.isPending, error: query.error };
}

const OPTIMISTIC_PREFIX = "optimistic-";

/** True while a newly created todo is waiting for the server to assign its real id. */
export const isPendingTodo = (todo: Todo) => todo.id.startsWith(OPTIMISTIC_PREFIX);

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

export function useLists() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: keys.lists, queryFn: api.lists.list });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: keys.lists });

  const create = useMutation({ mutationFn: api.lists.create, onSuccess: invalidate });
  const rename = useMutation({
    mutationFn: ({ listId, name }: { listId: string; name: string }) =>
      api.lists.rename(listId, name),
    onSuccess: invalidate,
  });
  // Drop the list from the cache right away so its panel unmounts before any refetch could 404.
  const dropFromCache = (listId: string) => {
    queryClient.setQueryData<List[]>(keys.lists, (old) => old?.filter((l) => l.id !== listId));
    queryClient.removeQueries({ queryKey: ["lists", listId] });
    invalidate();
  };
  const remove = useMutation({
    mutationFn: api.lists.remove,
    onSuccess: (_data, listId) => dropFromCache(listId),
  });
  const leave = useMutation({
    mutationFn: ({ listId, userId }: { listId: string; userId: string }) =>
      api.members.remove(listId, userId),
    onSuccess: (_data, { listId }) => dropFromCache(listId),
  });

  return {
    lists: query.data ?? [],
    isPending: query.isPending,
    error: query.error ?? create.error ?? rename.error ?? remove.error ?? leave.error,
    actions: {
      create: (name: string) => create.mutateAsync(name),
      rename: (list: List, name: string) => rename.mutate({ listId: list.id, name }),
      remove: (list: List) => remove.mutateAsync(list.id),
      leave: (list: List, userId: string) => leave.mutateAsync({ listId: list.id, userId }),
    },
  };
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export function useMembers(listId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: keys.members(listId),
    queryFn: () => api.members.list(listId),
  });
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.members(listId) }),
      queryClient.invalidateQueries({ queryKey: keys.lists }),
      queryClient.invalidateQueries({ queryKey: keys.collaborators }),
    ]);

  const add = useMutation({
    mutationFn: (email: string) => api.members.add(listId, email),
    onSuccess: () => invalidate(),
  });
  const remove = useMutation({
    mutationFn: (userId: string) => api.members.remove(listId, userId),
    onSuccess: () => invalidate(),
  });

  return {
    members: query.data ?? [],
    isPending: query.isPending,
    error: query.error ?? add.error ?? remove.error,
    isAdding: add.isPending,
    actions: {
      add: (email: string) => add.mutateAsync(email),
      remove: (userId: string) => remove.mutateAsync(userId),
      resetError: () => {
        add.reset();
        remove.reset();
      },
    },
  };
}

export function useCollaborators() {
  const query = useQuery({ queryKey: keys.collaborators, queryFn: api.lists.collaborators });
  return { collaborators: query.data ?? [] };
}

// ---------------------------------------------------------------------------
// Todos (per list)
// ---------------------------------------------------------------------------

function useOptimistic<TVars>(
  listId: string,
  mutationFn: (vars: TVars) => Promise<unknown>,
  apply: (todos: Todo[], vars: TVars) => Todo[],
) {
  const queryClient = useQueryClient();
  const key = keys.todos(listId);
  return useMutation({
    mutationFn,
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Todo[]>(key);
      queryClient.setQueryData<Todo[]>(key, (old = []) => apply(old, vars));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: keys.overview });
    },
  });
}

/** `me` lets optimistic updates show the right attribution before the server confirms. */
export function useTodos(listId: string, me: Actor) {
  const query = useQuery({
    queryKey: keys.todos(listId),
    queryFn: () => api.todos.list(listId),
    enabled: listId !== "",
  });

  const create = useOptimistic(
    listId,
    (title: string) => api.todos.create(listId, { title }),
    (todos, title) => [
      {
        id: `${OPTIMISTIC_PREFIX}${crypto.randomUUID()}`,
        title,
        completed: false,
        createdAt: Date.now(),
        createdBy: me,
        completedBy: null,
        completedAt: null,
      },
      ...todos,
    ],
  );

  const update = useOptimistic(
    listId,
    ({ id, patch }: { id: string; patch: UpdateTodoInput }) => api.todos.update(listId, id, patch),
    (todos, { id, patch }) =>
      todos.map((t) => {
        if (t.id !== id) return t;
        const attribution =
          patch.completed === undefined
            ? {}
            : patch.completed
              ? { completedBy: me, completedAt: Date.now() }
              : { completedBy: null, completedAt: null };
        return { ...t, ...patch, ...attribution };
      }),
  );

  const remove = useOptimistic(
    listId,
    (id: string) => api.todos.remove(listId, id),
    (todos, id) => todos.filter((t) => t.id !== id),
  );

  const clearCompleted = useOptimistic(
    listId,
    () => api.todos.clearCompleted(listId),
    (todos) => todos.filter((t) => !t.completed),
  );

  const todos = query.data ?? [];

  return {
    todos,
    isPending: query.isPending,
    error: query.error ?? create.error ?? update.error ?? remove.error ?? clearCompleted.error,
    counts: {
      all: todos.length,
      active: todos.filter((t) => !t.completed).length,
      completed: todos.filter((t) => t.completed).length,
    },
    actions: {
      create: (title: string) => create.mutate(title),
      toggle: (todo: Todo) => {
        if (isPendingTodo(todo)) return;
        update.mutate({ id: todo.id, patch: { completed: !todo.completed } });
      },
      rename: (todo: Todo, title: string) => {
        if (isPendingTodo(todo)) return;
        update.mutate({ id: todo.id, patch: { title } });
      },
      remove: (todo: Todo) => {
        if (isPendingTodo(todo)) return;
        remove.mutate(todo.id);
      },
      clearCompleted: () => clearCompleted.mutate(),
    },
  };
}

// ---------------------------------------------------------------------------
// Master list (toggle from the cross-list overview)
// ---------------------------------------------------------------------------

export function useOverviewToggle(me: Actor) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, id, completed }: { listId: string; id: string; completed: boolean }) =>
      api.todos.update(listId, id, { completed }),
    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey: keys.overview });
      const previous = queryClient.getQueryData<Overview>(keys.overview);
      queryClient.setQueryData<Overview>(
        keys.overview,
        (old) =>
          old && {
            todos: old.todos.map((t) =>
              t.id === id
                ? { ...t, completed, ...(completed ? { completedBy: me, completedAt: Date.now() } : { completedBy: null, completedAt: null }) }
                : t,
            ),
          },
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(keys.overview, context.previous);
    },
    onSettled: (_data, _err, { listId }) => {
      queryClient.invalidateQueries({ queryKey: keys.overview });
      queryClient.invalidateQueries({ queryKey: keys.todos(listId) });
    },
  });
}

export function useOverviewMove() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fromListId, id, toListId }: MoveVars) => api.todos.move(fromListId, id, toListId),
    onMutate: async ({ id, toListId, toListName }) => {
      await queryClient.cancelQueries({ queryKey: keys.overview });
      const previous = queryClient.getQueryData<Overview>(keys.overview);
      queryClient.setQueryData<Overview>(
        keys.overview,
        (old) =>
          old && {
            todos: old.todos.map((t) => (t.id === id ? { ...t, listId: toListId, listName: toListName } : t)),
          },
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(keys.overview, context.previous);
    },
    onSettled: (_data, _err, { fromListId, toListId }) => {
      queryClient.invalidateQueries({ queryKey: keys.overview });
      queryClient.invalidateQueries({ queryKey: keys.todos(fromListId) });
      queryClient.invalidateQueries({ queryKey: keys.todos(toListId) });
    },
  });
}

type MoveVars = { fromListId: string; id: string; toListId: string; toListName: string };

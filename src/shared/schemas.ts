import { z } from "zod";

export const todoTitleSchema = z
  .string()
  .trim()
  .min(1, "Title can't be empty")
  .max(200, "Title must be 200 characters or fewer");

export const actorSchema = z.object({ id: z.string(), name: z.string() });

export const todoSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean(),
  createdAt: z.number(),
  createdBy: actorSchema.nullable(),
  completedBy: actorSchema.nullable(),
  completedAt: z.number().nullable(),
});

export type Actor = z.infer<typeof actorSchema>;

export const todoListSchema = z.array(todoSchema);

export const createTodoSchema = z.object({
  title: todoTitleSchema,
});

export const updateTodoSchema = z
  .object({
    title: todoTitleSchema.optional(),
    completed: z.boolean().optional(),
  })
  .refine((v) => v.title !== undefined || v.completed !== undefined, {
    message: "Provide at least one field to update",
  });

export const moveTodoSchema = z.object({ toListId: z.string().min(1) });

export const emailSchema = z.email("Enter a valid email address");
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be 128 characters or fewer");

export const signInSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const signUpSchema = signInSchema.extend({
  name: z.string().trim().min(1, "Name can't be empty").max(80, "Name is too long"),
});

export const authConfigSchema = z.object({
  google: z.boolean(),
  magicLink: z.boolean(),
  passwordReset: z.boolean(),
  turnstileSiteKey: z.string().nullable(),
});

export const setPasswordSchema = z.object({ newPassword: passwordSchema });

export const newPasswordFormSchema = z
  .object({ newPassword: passwordSchema, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });

export const changePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });

export type AuthConfig = z.infer<typeof authConfigSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;

export const listNameSchema = z
  .string()
  .trim()
  .min(1, "List name can't be empty")
  .max(60, "List name must be 60 characters or fewer");

export const memberRoleSchema = z.enum(["owner", "editor"]);

export const listSchema = z.object({
  id: z.string(),
  name: z.string(),
  ownerId: z.string(),
  role: memberRoleSchema,
  memberCount: z.number(),
  createdAt: z.number(),
});

export const listArraySchema = z.array(listSchema);

export const createListSchema = z.object({ name: listNameSchema });
export const updateListSchema = z.object({ name: listNameSchema });

export const memberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  role: memberRoleSchema,
});

export const memberArraySchema = z.array(memberSchema);

export const addMemberSchema = z.object({ email: emailSchema });

export const collaboratorSchema = z.object({ id: z.string(), name: z.string(), email: z.string() });
export const collaboratorsSchema = z.object({ collaborators: z.array(collaboratorSchema) });

export const overviewTodoSchema = todoSchema.extend({ listId: z.string(), listName: z.string() });
export const overviewSchema = z.object({ todos: z.array(overviewTodoSchema) });

export const roomEventSchema = z.object({
  type: z.enum(["todos", "list", "members"]),
  listId: z.string(),
});

export type List = z.infer<typeof listSchema>;
export type MemberRole = z.infer<typeof memberRoleSchema>;
export type Member = z.infer<typeof memberSchema>;
export type Collaborator = z.infer<typeof collaboratorSchema>;
export type Collaborators = z.infer<typeof collaboratorsSchema>;
export type OverviewTodo = z.infer<typeof overviewTodoSchema>;
export type Overview = z.infer<typeof overviewSchema>;
export type RoomEvent = z.infer<typeof roomEventSchema>;

export type Todo = z.infer<typeof todoSchema>;
export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;

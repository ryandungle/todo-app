import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { signOut, useSession } from "./auth-client";

export type AuthUser = { id: string; name: string; email: string; emailVerified: boolean };

type AuthState =
  | { status: "loading"; user: null }
  | { status: "signed-out"; user: null }
  | { status: "signed-in"; user: AuthUser };

export function useAuth(): AuthState & { signOut: () => void } {
  const session = useSession();
  const queryClient = useQueryClient();
  const user = session.data?.user ?? null;

  // Drop per-user server state once the session is gone. Runs after commit, so
  // components that depended on that data are already unmounted. Public queries
  // (like /api/config, which the sign-in page is fetching at this very moment)
  // must survive — clearing everything would cancel them mid-flight.
  useEffect(() => {
    if (!session.isPending && !user) {
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "config" });
    }
  }, [session.isPending, user, queryClient]);

  const base = session.isPending
    ? { status: "loading" as const, user: null }
    : user
      ? { status: "signed-in" as const, user }
      : { status: "signed-out" as const, user: null };

  return { ...base, signOut: () => void signOut() };
}

import "server-only";
import { redirect } from "next/navigation";
import { isAuthenticated } from "./auth";

/**
 * Guard for every admin server action.
 *
 * The (dash) layout gates admin *pages*, but a server action is a POST
 * endpoint that anyone can call directly with the right action id -- the
 * layout does not protect it. So each mutation re-checks for itself.
 */
export async function requireAdmin(): Promise<void> {
  if (!(await isAuthenticated())) {
    redirect("/admin/login");
  }
}

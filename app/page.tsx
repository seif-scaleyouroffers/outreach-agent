import { redirect } from "next/navigation";

// This used to be a public "create an agent" form — that's now the
// invite-only flow at /admin, and this page is no longer a public entry
// point for creating accounts. Just sends visitors to log in.
export default function HomePage() {
  redirect("/login");
}

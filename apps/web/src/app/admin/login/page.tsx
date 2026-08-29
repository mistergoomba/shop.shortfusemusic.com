import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  if (await isAuthenticated()) redirect("/admin");

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center text-2xl text-bone">Short Fuse Admin</h1>
        <p className="mb-8 text-center text-sm text-bone-faint">
          Staff only. Everyone else, the shop is that way.
        </p>
        <LoginForm />
      </div>
    </div>
  );
}

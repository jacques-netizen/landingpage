import { SignIn } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6 py-16 pt-[76px]">
      <SignIn />
    </main>
  );
}

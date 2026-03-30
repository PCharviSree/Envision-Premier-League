import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col gap-6 items-center justify-center py-16 px-16 bg-white dark:bg-black sm:items-start">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Sports League Management Platform
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Use role-based dashboards after logging in:
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <a className="rounded-full bg-black text-white px-6 py-3" href="/login">
            Login / Signup
          </a>
          <a className="rounded-full border border-black/10 px-6 py-3" href="/admin">
            Admin
          </a>
          <a className="rounded-full border border-black/10 px-6 py-3" href="/player">
            Player
          </a>
          <a className="rounded-full border border-black/10 px-6 py-3" href="/franchise">
            Franchise
          </a>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Next: run <code>npm install</code> + Prisma migrations on Replit, then use the dashboards.
        </p>
      </main>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

type Role = "ADMIN" | "FRANCHISE_OWNER" | "PLAYER";
type Me = { id: string; email: string; name: string; role: Role };

type Game = {
  id: string;
  name: string;
  rules: string;
  maxPlayersPerTeam: number;
  requiredPlayers: number;
  createdAt: string;
};

type SkillType = "BATTER" | "DEFENDER" | "MIDFIELDER" | "GOALKEEPER" | "OTHER";

export default function PlayerPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [games, setGames] = useState<Game[]>([]);
  const [enrollGameId, setEnrollGameId] = useState("");

  const [psid, setPsid] = useState("");
  const [registerBusy, setRegisterBusy] = useState(false);

  const [skillGameId, setSkillGameId] = useState("");
  const [skillType, setSkillType] = useState<SkillType>("BATTER");
  const [rating, setRating] = useState(50);
  const [skillBusy, setSkillBusy] = useState(false);

  const [enrollBusy, setEnrollBusy] = useState(false);

  useEffect(() => {
    async function load() {
      setError(null);
      const res = await fetch("/api/me");
      if (!res.ok) {
        window.location.href = "/login";
        return;
      }
      const data = await res.json();
      if (data?.user?.role !== "PLAYER") {
        window.location.href = "/login";
        return;
      }
      setMe(data.user);

      const gamesRes = await fetch("/api/games");
      const gamesData = await gamesRes.json();
      const nextGames = gamesData.games ?? [];
      setGames(nextGames);
      const first = nextGames[0]?.id ?? "";
      setEnrollGameId(first);
      setSkillGameId(first);
    }
    load().catch(() => setError("Failed to load player page"));
  }, []);

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function registerPlayer(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setRegisterBusy(true);
    try {
      const res = await fetch("/api/players/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ psid }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to register");
      setPsid("");
    } catch (e: any) {
      setError(e?.message ?? "Failed to register");
    } finally {
      setRegisterBusy(false);
    }
  }

  async function enroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enrollGameId) {
      setError("Select a game");
      return;
    }
    setError(null);
    setEnrollBusy(true);
    try {
      const res = await fetch("/api/players/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: enrollGameId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Enrollment failed");
    } catch (e: any) {
      setError(e?.message ?? "Enrollment failed");
    } finally {
      setEnrollBusy(false);
    }
  }

  async function submitSkill(e: React.FormEvent) {
    e.preventDefault();
    if (!skillGameId) {
      setError("Select a game");
      return;
    }
    setError(null);
    setSkillBusy(true);
    try {
      const res = await fetch("/api/players/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: skillGameId, skillType, rating }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Skill submission failed");
    } catch (e: any) {
      setError(e?.message ?? "Skill submission failed");
    } finally {
      setSkillBusy(false);
    }
  }

  return (
    <div className="min-h-screen p-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Player Dashboard</h1>
          {me ? <p className="text-sm text-zinc-600 mt-1">Signed in as {me.name}</p> : null}
        </div>
        <div className="flex gap-2">
          <button onClick={onLogout} className="rounded-xl bg-black text-white px-4 py-2">
            Logout
          </button>
        </div>
      </div>

      {error ? <p className="mt-4 text-red-600 text-sm">{error}</p> : null}

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white border border-zinc-200 rounded-2xl p-5">
          <h2 className="font-semibold">Player Profile</h2>
          <form onSubmit={registerPlayer} className="mt-4 flex flex-col gap-3 max-w-sm">
            <input
              placeholder="PSID (your player handle)"
              value={psid}
              onChange={(e) => setPsid(e.target.value)}
              className="border border-zinc-300 rounded-lg px-3 py-2"
              required
            />
            <button disabled={registerBusy} className="rounded-xl bg-black text-white px-4 py-2 disabled:opacity-50" type="submit">
              Register
            </button>
          </form>
          <p className="mt-3 text-xs text-zinc-500">
            After registering your PSID, you can enroll in games and set skill ratings.
          </p>
        </section>

        <section className="bg-white border border-zinc-200 rounded-2xl p-5">
          <h2 className="font-semibold">Enroll in Game</h2>
          <form onSubmit={enroll} className="mt-4 flex flex-col gap-3 max-w-sm">
            <select
              value={enrollGameId}
              onChange={(e) => setEnrollGameId(e.target.value)}
              className="border border-zinc-300 rounded-lg px-3 py-2"
            >
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <button disabled={enrollBusy} className="rounded-xl bg-black text-white px-4 py-2 disabled:opacity-50" type="submit">
              Enroll
            </button>
          </form>
        </section>
      </div>

      <section className="mt-6 bg-white border border-zinc-200 rounded-2xl p-5">
        <h2 className="font-semibold">Submit Skill Ratings</h2>
        <form onSubmit={submitSkill} className="mt-4 flex flex-col gap-3 max-w-xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              value={skillGameId}
              onChange={(e) => setSkillGameId(e.target.value)}
              className="border border-zinc-300 rounded-lg px-3 py-2"
            >
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <select
              value={skillType}
              onChange={(e) => setSkillType(e.target.value as SkillType)}
              className="border border-zinc-300 rounded-lg px-3 py-2"
            >
              <option value="BATTER">BATTER</option>
              <option value="DEFENDER">DEFENDER</option>
              <option value="MIDFIELDER">MIDFIELDER</option>
              <option value="GOALKEEPER">GOALKEEPER</option>
              <option value="OTHER">OTHER</option>
            </select>
            <input
              type="number"
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="border border-zinc-300 rounded-lg px-3 py-2"
              min={0}
              max={100}
            />
          </div>
          <button disabled={skillBusy} className="rounded-xl bg-black text-white px-4 py-2 disabled:opacity-50" type="submit">
            Submit Skill
          </button>
        </form>
      </section>
    </div>
  );
}


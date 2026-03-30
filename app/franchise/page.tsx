"use client";

import { useEffect, useMemo, useState } from "react";

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

type OpenAuction = {
  auctionId: string;
  playerId: string;
  psid: string | null;
  isBanned: boolean;
  highestBidAmount: number | null;
  highestBidFranchiseId: string | null;
  myBidAmount: number | null;
};

type Recommendation = {
  playerId: string;
  psid: string;
  bestSkillType: string | null;
  skillRating: number;
  disciplineRating: number;
  score: number;
};

export default function FranchisePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [games, setGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState("");

  const [franchise, setFranchise] = useState<any>(null);
  const [franchiseMissing, setFranchiseMissing] = useState(false);

  const [createName, setCreateName] = useState("");
  const [createBudget, setCreateBudget] = useState(1000);

  const [openAuctions, setOpenAuctions] = useState<OpenAuction[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [bidAmounts, setBidAmounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  const selectedGame = useMemo(
    () => games.find((g) => g.id === selectedGameId) ?? null,
    [games, selectedGameId]
  );

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/me");
      if (!res.ok) {
        window.location.href = "/login";
        return;
      }
      const data = await res.json();
      if (data?.user?.role !== "FRANCHISE_OWNER") {
        window.location.href = "/login";
        return;
      }
      setMe(data.user);

      const gamesRes = await fetch("/api/games");
      const gamesData = await gamesRes.json();
      const nextGames = gamesData.games ?? [];
      setGames(nextGames);
      setSelectedGameId(nextGames[0]?.id ?? "");

      const fRes = await fetch("/api/franchises/me");
      if (!fRes.ok) {
        setFranchiseMissing(true);
      } else {
        const fData = await fRes.json();
        setFranchise(fData.franchise ?? null);
        setFranchiseMissing(false);
      }
    }
    load().catch(() => setError("Failed to load franchise page"));
  }, []);

  useEffect(() => {
    if (!selectedGameId) return;
    refreshOpenAuctions(selectedGameId);
    refreshRecommendations(selectedGameId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGameId]);

  async function refreshOpenAuctions(gameId: string) {
    const res = await fetch(`/api/auctions/open?gameId=${encodeURIComponent(gameId)}`);
    const data = await res.json();
    setOpenAuctions(data.auctions ?? []);
  }

  async function refreshRecommendations(gameId: string) {
    const res = await fetch(`/api/recommendations?gameId=${encodeURIComponent(gameId)}`);
    const data = await res.json();
    setRecommendations(data.recommendations ?? []);
  }

  async function refreshFranchiseMe() {
    const res = await fetch("/api/franchises/me");
    if (!res.ok) return;
    const data = await res.json();
    setFranchise(data.franchise ?? null);
  }

  async function onCreateFranchise(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/franchises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName, budget: createBudget }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to create franchise");
      setCreateName("");
      setFranchiseMissing(false);
      await refreshFranchiseMe();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create franchise");
    } finally {
      setBusy(false);
    }
  }

  async function placeBid(auctionId: string) {
    const amount = bidAmounts[auctionId];
    if (!amount || amount < 0) {
      setError("Enter a valid bid amount");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auctions/bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auctionId, amount }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to place bid");
      await refreshOpenAuctions(selectedGameId);
      await refreshFranchiseMe();
    } catch (e: any) {
      setError(e?.message ?? "Failed to place bid");
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen p-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Franchise Dashboard</h1>
          {me ? <p className="text-sm text-zinc-600 mt-1">Signed in as {me.name}</p> : null}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refreshOpenAuctions(selectedGameId)}
            className="rounded-xl border border-zinc-200 px-4 py-2"
          >
            Refresh Auctions
          </button>
          <button
            onClick={() => onLogout()}
            className="rounded-xl bg-black text-white px-4 py-2"
          >
            Logout
          </button>
        </div>
      </div>

      {error ? <p className="mt-4 text-red-600 text-sm">{error}</p> : null}

      <section className="mt-6 bg-white border border-zinc-200 rounded-2xl p-5">
        <h2 className="font-semibold">Franchise</h2>
        {franchiseMissing ? (
          <form onSubmit={onCreateFranchise} className="mt-4 flex flex-col gap-3 max-w-sm">
            <input
              placeholder="Franchise name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              className="border border-zinc-300 rounded-lg px-3 py-2"
              required
            />
            <input
              type="number"
              value={createBudget}
              onChange={(e) => setCreateBudget(Number(e.target.value))}
              className="border border-zinc-300 rounded-lg px-3 py-2"
              placeholder="Budget"
              required
            />
            <button disabled={busy} type="submit" className="rounded-xl bg-black text-white px-4 py-2 disabled:opacity-50">
              Create Franchise
            </button>
          </form>
        ) : (
          <div className="mt-3 text-sm text-zinc-700">
            <div>Name: <span className="font-medium">{franchise?.name ?? "-"}</span></div>
            <div>Budget: <span className="font-medium">{franchise?.budget ?? 0}</span></div>
          </div>
        )}
      </section>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white border border-zinc-200 rounded-2xl p-5">
          <h2 className="font-semibold">Select Game</h2>
          <div className="mt-3 flex flex-col gap-2">
            {games.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelectedGameId(g.id)}
                className={
                  "text-left rounded-xl border px-4 py-3 " +
                  (g.id === selectedGameId ? "border-black bg-zinc-50" : "border-zinc-200 hover:border-zinc-300")
                }
              >
                <div className="font-medium">{g.name}</div>
                <div className="text-xs text-zinc-600">Max/team: {g.maxPlayersPerTeam}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="bg-white border border-zinc-200 rounded-2xl p-5">
          <h2 className="font-semibold">AI Recommendations</h2>
          <div className="mt-2 text-xs text-zinc-600">
            Rule-based score using your future-friendly formula.
          </div>
          <div className="mt-3 overflow-auto max-h-[360px] border border-zinc-200 rounded-xl">
            {recommendations.length === 0 ? (
              <div className="p-3 text-sm text-zinc-600">No recommendations yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="p-3 text-left">PSID</th>
                    <th className="p-3 text-left">Skill</th>
                    <th className="p-3 text-left">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {recommendations.map((r) => (
                    <tr key={r.playerId} className="border-t border-zinc-200">
                      <td className="p-3">{r.psid}</td>
                      <td className="p-3">
                        {r.bestSkillType ?? "-"} ({r.skillRating})
                      </td>
                      <td className="p-3 font-medium">{r.score.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      <section className="mt-6 bg-white border border-zinc-200 rounded-2xl p-5">
        <h2 className="font-semibold">Open Auctions</h2>
        {openAuctions.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">No open auctions yet (admin must start auctions).</p>
        ) : (
          <div className="mt-3 overflow-auto max-h-[420px] border border-zinc-200 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="p-3 text-left">PSID</th>
                  <th className="p-3 text-left">Highest Bid</th>
                  <th className="p-3 text-left">Your Bid</th>
                  <th className="p-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {openAuctions.map((a) => (
                  <tr key={a.auctionId} className="border-t border-zinc-200">
                    <td className="p-3">{a.psid ?? "-"}</td>
                    <td className="p-3">{a.highestBidAmount ?? "-"}</td>
                    <td className="p-3">
                      <input
                        type="number"
                        min={0}
                        value={bidAmounts[a.auctionId] ?? ""}
                        onChange={(e) =>
                          setBidAmounts((prev) => ({
                            ...prev,
                            [a.auctionId]: e.target.value === "" ? 0 : Number(e.target.value),
                          }))
                        }
                        className="border border-zinc-300 rounded-lg px-3 py-2 w-28"
                      />
                    </td>
                    <td className="p-3">
                      <button
                        disabled={busy || a.isBanned}
                        onClick={() => placeBid(a.auctionId)}
                        className="rounded-xl bg-black text-white px-4 py-2 disabled:opacity-50"
                      >
                        Bid
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-8 text-xs text-zinc-500">
        Your bids are silent; admin finalizes once to assign players and deduct budget.
      </div>
    </div>
  );
}


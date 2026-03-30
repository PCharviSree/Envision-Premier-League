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

type Franchise = { id: string; name: string; budget: number };
type OpenAuction = {
  auctionId: string;
  playerId: string;
  psid: string | null;
  isBanned: boolean;
  highestBidAmount: number | null;
  highestBidFranchiseId: string | null;
  myBidAmount: number | null;
};

export default function AdminPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [games, setGames] = useState<Game[]>([]);
  const [franchises, setFranchises] = useState<Franchise[]>([]);

  const [createName, setCreateName] = useState("");
  const [createRules, setCreateRules] = useState("Simple MVP league rules.");
  const [createMaxPlayers, setCreateMaxPlayers] = useState(11);
  const [createRequiredPlayers, setCreateRequiredPlayers] = useState(10);
  const [selectedGameId, setSelectedGameId] = useState<string>("");

  const [openAuctions, setOpenAuctions] = useState<OpenAuction[]>([]);
  const [auctionBusy, setAuctionBusy] = useState(false);

  const [matchStart, setMatchStart] = useState("");
  const [matchEnd, setMatchEnd] = useState("");
  const [matchTeam1, setMatchTeam1] = useState("");
  const [matchTeam2, setMatchTeam2] = useState("");
  const [matchBusy, setMatchBusy] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);

  const [foulPlayerId, setFoulPlayerId] = useState("");
  const [foulPenalty, setFoulPenalty] = useState(5);
  const [foulReason, setFoulReason] = useState("Minor foul");
  const [foulBusy, setFoulBusy] = useState(false);

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
      if (data?.user?.role !== "ADMIN") {
        window.location.href = "/login";
        return;
      }
      setMe(data.user);

      const gamesRes = await fetch("/api/games");
      const gamesData = await gamesRes.json();
      setGames(gamesData.games ?? []);
      setSelectedGameId((g: string) => g || (gamesData.games?.[0]?.id ?? ""));

      const frRes = await fetch("/api/franchises");
      const frData = await frRes.json();
      setFranchises(frData.franchises ?? []);

      await refreshMatches(gamesData.games?.[0]?.id);
    }

    load().catch(() => setError("Failed to load admin page"));
  }, []);

  async function refreshGames() {
    const gamesRes = await fetch("/api/games");
    const gamesData = await gamesRes.json();
    const nextGames = gamesData.games ?? [];
    setGames(nextGames);
    if (!selectedGameId && nextGames[0]?.id) setSelectedGameId(nextGames[0].id);
  }

  async function refreshOpenAuctions(gameId?: string) {
    if (!gameId) return;
    const res = await fetch(`/api/auctions/open?gameId=${encodeURIComponent(gameId)}`);
    const data = await res.json();
    setOpenAuctions(data.auctions ?? []);
  }

  async function refreshMatches(gameId?: string) {
    if (!gameId) return;
    const res = await fetch(`/api/matches?gameId=${encodeURIComponent(gameId)}`);
    const data = await res.json();
    setMatches(data.matches ?? []);
  }

  async function onCreateGame(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: createName,
        rules: createRules,
        maxPlayersPerTeam: createMaxPlayers,
        requiredPlayers: createRequiredPlayers,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed to create game");
      return;
    }
    setCreateName("");
    await refreshGames();
    if (!selectedGameId && data?.game?.id) setSelectedGameId(data.game.id);
  }

  async function startAuction() {
    if (!selectedGameId) return;
    setAuctionBusy(true);
    try {
      const res = await fetch("/api/auctions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: selectedGameId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Start auction failed");
      await refreshOpenAuctions(selectedGameId);
    } catch (e: any) {
      setError(e?.message ?? "Start auction failed");
    } finally {
      setAuctionBusy(false);
    }
  }

  async function finalizeAuction() {
    if (!selectedGameId) return;
    setAuctionBusy(true);
    try {
      const res = await fetch("/api/auctions/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: selectedGameId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Finalize failed");
      await refreshOpenAuctions(selectedGameId);
      await refreshMatches(selectedGameId);
    } catch (e: any) {
      setError(e?.message ?? "Finalize failed");
    } finally {
      setAuctionBusy(false);
    }
  }

  async function createMatch(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGameId || !matchTeam1 || !matchTeam2 || !matchStart || !matchEnd) {
      setError("Please fill all match fields");
      return;
    }
    setMatchBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: selectedGameId,
          team1FranchiseId: matchTeam1,
          team2FranchiseId: matchTeam2,
          startTime: matchStart,
          endTime: matchEnd,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Match creation failed");
      setMatchStart("");
      setMatchEnd("");
      await refreshMatches(selectedGameId);
    } catch (e: any) {
      setError(e?.message ?? "Match creation failed");
    } finally {
      setMatchBusy(false);
    }
  }

  async function addFoul(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGameId || !foulPlayerId) {
      setError("Select a game and enter playerId");
      return;
    }
    setFoulBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/fouls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: selectedGameId,
          playerId: foulPlayerId,
          penaltyPoints: foulPenalty,
          reason: foulReason,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to add foul");
      setFoulPlayerId("");
    } catch (e: any) {
      setError(e?.message ?? "Failed to add foul");
    } finally {
      setFoulBusy(false);
    }
  }

  async function refreshAll() {
    await refreshGames();
    await refreshOpenAuctions(selectedGameId);
    await refreshMatches(selectedGameId);
  }

  async function onSelectGame(id: string) {
    setSelectedGameId(id);
    await Promise.all([refreshOpenAuctions(id), refreshMatches(id)]);
  }

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen p-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
          {me ? <p className="text-sm text-zinc-600 mt-1">Signed in as {me.name}</p> : null}
        </div>
        <div className="flex gap-2">
          <button onClick={() => refreshAll()} className="rounded-xl border border-zinc-200 px-4 py-2">
            Refresh
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

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white border border-zinc-200 rounded-2xl p-5">
          <h2 className="font-semibold">Create Game</h2>
          <form onSubmit={onCreateGame} className="mt-4 flex flex-col gap-3">
            <input
              placeholder="Game name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              className="border border-zinc-300 rounded-lg px-3 py-2"
            />
            <textarea
              value={createRules}
              onChange={(e) => setCreateRules(e.target.value)}
              className="border border-zinc-300 rounded-lg px-3 py-2 min-h-[80px]"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                value={createMaxPlayers}
                onChange={(e) => setCreateMaxPlayers(Number(e.target.value))}
                className="border border-zinc-300 rounded-lg px-3 py-2"
                placeholder="Max players/team"
              />
              <input
                type="number"
                value={createRequiredPlayers}
                onChange={(e) => setCreateRequiredPlayers(Number(e.target.value))}
                className="border border-zinc-300 rounded-lg px-3 py-2"
                placeholder="Required players"
              />
            </div>
            <button type="submit" className="rounded-xl bg-black text-white px-4 py-2">
              Create
            </button>
          </form>
        </section>

        <section className="bg-white border border-zinc-200 rounded-2xl p-5">
          <h2 className="font-semibold">Select Game</h2>
          <div className="mt-4 flex flex-col gap-2">
            {games.length === 0 ? (
              <p className="text-sm text-zinc-600">No games yet.</p>
            ) : (
              games.map((g) => (
                <button
                  key={g.id}
                  onClick={() => onSelectGame(g.id)}
                  className={
                    "text-left rounded-xl border px-4 py-3 " +
                    (g.id === selectedGameId
                      ? "border-black bg-zinc-50"
                      : "border-zinc-200 hover:border-zinc-300")
                  }
                >
                  <div className="font-medium">{g.name}</div>
                  <div className="text-xs text-zinc-600">Max/team: {g.maxPlayersPerTeam}</div>
                </button>
              ))
            )}
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <button disabled={auctionBusy || !selectedGameId} onClick={startAuction} className="rounded-xl bg-black text-white px-4 py-2 disabled:opacity-50">
              Start Auctions
            </button>
            <button disabled={auctionBusy || !selectedGameId} onClick={finalizeAuction} className="rounded-xl border border-black px-4 py-2 disabled:opacity-50">
              Finalize Auctions
            </button>
          </div>
        </section>
      </div>

      <section className="mt-6 bg-white border border-zinc-200 rounded-2xl p-5">
        <h2 className="font-semibold">Open Auctions</h2>
        <div className="mt-3">
          <div className="text-xs text-zinc-600 mb-2">
            Auction list for selected game (highest bid shown).
          </div>
          {openAuctions.length === 0 ? (
            <p className="text-sm text-zinc-600">No open auctions yet.</p>
          ) : (
            <div className="overflow-auto max-h-[320px] border border-zinc-200 rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="p-3 text-left">Player</th>
                    <th className="p-3 text-left">PSID</th>
                    <th className="p-3 text-left">Highest Bid</th>
                  </tr>
                </thead>
                <tbody>
                  {openAuctions.map((a) => (
                    <tr key={a.auctionId} className="border-t border-zinc-200">
                      <td className="p-3 font-mono">{a.playerId.slice(0, 8)}…</td>
                      <td className="p-3">{a.psid ?? "-"}</td>
                      <td className="p-3">{a.highestBidAmount ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white border border-zinc-200 rounded-2xl p-5">
          <h2 className="font-semibold">Create Match</h2>
          <form onSubmit={createMatch} className="mt-4 flex flex-col gap-3">
            <select
              value={matchTeam1}
              onChange={(e) => setMatchTeam1(e.target.value)}
              className="border border-zinc-300 rounded-lg px-3 py-2"
            >
              <option value="">Team 1 franchise</option>
              {franchises.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <select
              value={matchTeam2}
              onChange={(e) => setMatchTeam2(e.target.value)}
              className="border border-zinc-300 rounded-lg px-3 py-2"
            >
              <option value="">Team 2 franchise</option>
              {franchises.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              value={matchStart}
              onChange={(e) => setMatchStart(e.target.value)}
              className="border border-zinc-300 rounded-lg px-3 py-2"
            />
            <input
              type="datetime-local"
              value={matchEnd}
              onChange={(e) => setMatchEnd(e.target.value)}
              className="border border-zinc-300 rounded-lg px-3 py-2"
            />
            <button disabled={matchBusy} className="rounded-xl bg-black text-white px-4 py-2 disabled:opacity-50" type="submit">
              Create Match
            </button>
          </form>

          <div className="mt-5">
            <h3 className="font-medium">Matches</h3>
            <div className="overflow-auto max-h-[220px] mt-3 border border-zinc-200 rounded-xl">
              {matches.length === 0 ? (
                <div className="p-3 text-sm text-zinc-600">No matches yet.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="p-3 text-left">Teams</th>
                      <th className="p-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((m) => (
                      <tr key={m.id} className="border-t border-zinc-200">
                        <td className="p-3">
                          {m.team1Name ?? m.team1FranchiseId.slice(0, 8)} vs{" "}
                          {m.team2Name ?? m.team2FranchiseId.slice(0, 8)}
                        </td>
                        <td className="p-3">
                          {m.status === "LIVE" ? <span className="text-red-600 font-semibold">LIVE</span> : m.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </section>

        <section className="bg-white border border-zinc-200 rounded-2xl p-5">
          <h2 className="font-semibold">Add Foul</h2>
          <form onSubmit={addFoul} className="mt-4 flex flex-col gap-3">
            <input
              placeholder="playerId (from auctions table)"
              value={foulPlayerId}
              onChange={(e) => setFoulPlayerId(e.target.value)}
              className="border border-zinc-300 rounded-lg px-3 py-2 font-mono"
            />
            <input
              type="number"
              value={foulPenalty}
              onChange={(e) => setFoulPenalty(Number(e.target.value))}
              className="border border-zinc-300 rounded-lg px-3 py-2"
            />
            <input
              placeholder="Reason"
              value={foulReason}
              onChange={(e) => setFoulReason(e.target.value)}
              className="border border-zinc-300 rounded-lg px-3 py-2"
            />
            <button disabled={foulBusy} className="rounded-xl bg-black text-white px-4 py-2 disabled:opacity-50" type="submit">
              Add foul
            </button>
          </form>
        </section>
      </div>

      <div className="mt-8 text-xs text-zinc-500">
        Note: This is MVP UI. Team/discipline logic is enforced at auction finalize + recommendation calculation.
      </div>
    </div>
  );
}


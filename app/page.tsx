"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

// ============================================
// TYPES
// ============================================
type Screen = "landing" | "lobby" | "game" | "results" | "stats" | "leaderboard";
type GamePhase = "lobby" | "round_1" | "round_2" | "completed";

interface Player {
  address: string;
  name: string;
  ready: boolean;
}

interface Scenario {
  id: number;
  type: string;
  title: string;
  description: string;
  content: string;
}

interface Room {
  room_code: string;
  host: string;
  players: Player[];
  status: GamePhase;
  scenarios: Scenario[];
  submissions: Record<string, any>;
  votes: Record<string, any>;
  results: any;
  current_round: number;
  solo_mode?: boolean;
}

interface RecentGame {
  game_id: number;
  room_code: string;
  players: Player[];
  results: any;
  timestamp: string;
}

// ============================================
// CONTRACT HELPERS — modelled after POH working page
// ============================================
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}` | undefined;
const MAX_ATTEMPTS = 3;

function getOrCreateAccount() {
  if (typeof window === "undefined") return createAccount();
  const stored = localStorage.getItem("htp_account");
  if (stored) {
    try { return JSON.parse(stored); } catch {}
  }
  const account = createAccount();
  localStorage.setItem("htp_account", JSON.stringify(account));
  return account;
}

function makeClient() {
  const account = getOrCreateAccount();
  const client = createClient({ chain: studionet, account });
  return { client, account };
}

async function readContract(functionName: string, args: any[]): Promise<any> {
  if (!CONTRACT_ADDRESS) throw new Error("Contract address not configured");
  const { client } = makeClient();
  return await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
  });
}

// Write + wait for receipt with retries (same pattern as working POH page)
async function writeContract(functionName: string, args: any[]): Promise<boolean> {
  if (!CONTRACT_ADDRESS) throw new Error("Contract address not configured");
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { client } = makeClient();
      console.log(`writeContract attempt ${attempt}/${MAX_ATTEMPTS}: ${functionName}`);
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName,
        args,
        leaderOnly: false,
      } as any);
      await client.waitForTransactionReceipt({
        hash,
        status: TransactionStatus.ACCEPTED,
        retries: 100,
        interval: 4000,
      });
      return true;
    } catch (err: any) {
      console.error(`writeContract ${functionName} attempt ${attempt} failed:`, err?.message);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, attempt * 3000));
        continue;
      }
      throw err;
    }
  }
  return false;
}

// For create_room we need the return value (room code).
// Strategy: simulate first to grab return value, then write + wait.
async function writeContractWithReturn(functionName: string, args: any[]): Promise<string> {
  if (!CONTRACT_ADDRESS) throw new Error("Contract address not configured");
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { client } = makeClient();
      console.log(`writeContractWithReturn attempt ${attempt}/${MAX_ATTEMPTS}: ${functionName}`);
      // Simulate to get return value
      const returnValue = await client.simulateWriteContract({
        address: CONTRACT_ADDRESS,
        functionName,
        args,
      });
      // Execute real tx
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName,
        args,
        leaderOnly: false,
      } as any);
      await client.waitForTransactionReceipt({
        hash,
        status: TransactionStatus.ACCEPTED,
        retries: 100,
        interval: 4000,
      });
      return returnValue as string;
    } catch (err: any) {
      console.error(`writeContractWithReturn ${functionName} attempt ${attempt} failed:`, err?.message);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, attempt * 3000));
        continue;
      }
      throw err;
    }
  }
  throw new Error("All attempts failed");
}

// ============================================
// STYLES
// ============================================
const C = {
  bg: "#0A0A0F",
  surface: "#13131A",
  card: "#1C1C28",
  border: "#2A2A3E",
  text: "#F0EEF8",
  muted: "#8B8BA0",
  primary: "#FF3D3D",
  fire: "#FF6B35",
  gold: "#FFD60A",
  green: "#00E5A0",
  purple: "#9B5DE5",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${C.bg}; color: ${C.text}; font-family: 'DM Sans', sans-serif; }
  ::placeholder { color: ${C.muted}; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: ${C.surface}; }
  ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
  input, textarea { background: ${C.surface}; color: ${C.text}; border: 1.5px solid ${C.border}; border-radius: 10px; padding: 0.85rem 1rem; font-family: 'DM Sans', sans-serif; font-size: 1rem; outline: none; transition: border 0.2s; width: 100%; }
  input:focus, textarea:focus { border-color: ${C.primary}; }
  textarea { resize: vertical; }

  .pulse { animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .fadeIn { animation: fadeIn 0.4s ease; }
  @keyframes fadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  .fireGlow { text-shadow: 0 0 20px ${C.primary}80, 0 0 40px ${C.fire}40; }
  
  .btn-primary {
    background: linear-gradient(135deg, ${C.primary}, ${C.fire});
    color: white;
    border: none;
    border-radius: 10px;
    padding: 0.9rem 1.8rem;
    font-family: 'DM Sans', sans-serif;
    font-weight: 700;
    font-size: 0.95rem;
    cursor: pointer;
    letter-spacing: 0.04em;
    transition: transform 0.15s, opacity 0.15s;
  }
  .btn-primary:hover:not(:disabled) { transform: translateY(-2px); opacity: 0.9; }
  .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

  .btn-outline {
    background: transparent;
    color: ${C.text};
    border: 1.5px solid ${C.border};
    border-radius: 10px;
    padding: 0.9rem 1.8rem;
    font-family: 'DM Sans', sans-serif;
    font-weight: 600;
    font-size: 0.95rem;
    cursor: pointer;
    transition: border-color 0.2s, transform 0.15s;
  }
  .btn-outline:hover:not(:disabled) { border-color: ${C.primary}; transform: translateY(-2px); }
  .btn-outline:disabled { opacity: 0.45; cursor: not-allowed; }

  .btn-gold {
    background: linear-gradient(135deg, ${C.gold}, #FFA500);
    color: #0A0A0F;
    border: none;
    border-radius: 10px;
    padding: 0.9rem 1.8rem;
    font-family: 'DM Sans', sans-serif;
    font-weight: 700;
    font-size: 0.95rem;
    cursor: pointer;
    transition: transform 0.15s, opacity 0.15s;
  }
  .btn-gold:hover:not(:disabled) { transform: translateY(-2px); }
  .btn-gold:disabled { opacity: 0.45; cursor: not-allowed; }

  .card {
    background: ${C.card};
    border: 1px solid ${C.border};
    border-radius: 16px;
    padding: 1.75rem;
  }

  .tag {
    display: inline-block;
    padding: 0.3rem 0.75rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .tag-fire { background: ${C.primary}22; color: ${C.primary}; border: 1px solid ${C.primary}44; }
  .tag-green { background: ${C.green}22; color: ${C.green}; border: 1px solid ${C.green}44; }
  .tag-gold { background: ${C.gold}22; color: ${C.gold}; border: 1px solid ${C.gold}44; }
  .tag-purple { background: ${C.purple}22; color: ${C.purple}; border: 1px solid ${C.purple}44; }
`;

// ============================================
// MAIN COMPONENT
// ============================================
export default function HotTakeProtocol() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [playerAddress, setPlayerAddress] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("");
  const [nameConfirmed, setNameConfirmed] = useState<boolean>(false);
  const [roomCode, setRoomCode] = useState<string>("");
  const [joinCodeInput, setJoinCodeInput] = useState<string>("");
  const [showJoinInput, setShowJoinInput] = useState<boolean>(false);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<number | null>(null);
  const [stance, setStance] = useState<string>("");
  const [hotTake, setHotTake] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMsg, setLoadingMsg] = useState<string>("");
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [envError, setEnvError] = useState<string>("");
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [myVotes, setMyVotes] = useState<Record<number, string>>({});
  const [votesSubmitted, setVotesSubmitted] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  // Init account
  useEffect(() => {
    if (!CONTRACT_ADDRESS) {
      setEnvError("Missing NEXT_PUBLIC_CONTRACT_ADDRESS environment variable.");
    } else {
      try {
        const acc = getOrCreateAccount();
        setPlayerAddress(acc.address);
      } catch (err) {
        setEnvError("Failed to create account: " + (err as Error).message);
      }
    }
  }, []);

  // Load recent games on landing
  useEffect(() => {
    if (screen === "landing" && CONTRACT_ADDRESS) {
      loadRecentGames();
    }
    if (screen === "leaderboard" && CONTRACT_ADDRESS) {
      loadLeaderboard();
    }
  }, [screen]);

  const loadRecentGames = async () => {
    try {
      const raw = await readContract("get_recent_games", [5]);
      if (raw) {
        const games = JSON.parse(raw as string);
        setRecentGames(games.reverse());
      }
    } catch (e) {
      console.error("Failed to load recent games", e);
    }
  };

  const loadLeaderboard = async () => {
    try {
      const raw = await readContract("get_global_leaderboard", []);
      if (raw) setLeaderboard(JSON.parse(raw as string));
    } catch (e) {
      console.error("Failed to load leaderboard", e);
    }
  };

  const fetchRoom = useCallback(async (code: string) => {
    if (!CONTRACT_ADDRESS) return;
    try {
      const roomJson = await readContract("get_room", [code]);
      if (roomJson) {
        const room: Room = JSON.parse(roomJson as string);
        setCurrentRoom(room);
        if (room.status === "round_1" && screen === "lobby") setScreen("game");
        else if (room.status === "completed" && screen !== "results") setScreen("results");
      }
    } catch (err) {
      console.error("Failed to fetch room", err);
    }
  }, [screen]);

  useEffect(() => {
    if (roomCode && (screen === "lobby" || screen === "game") && CONTRACT_ADDRESS) {
      fetchRoom(roomCode);
      pollInterval.current = setInterval(() => fetchRoom(roomCode), 5000);
      return () => { if (pollInterval.current) clearInterval(pollInterval.current); };
    }
  }, [roomCode, screen, fetchRoom]);

  const doLoading = (msg: string, active: boolean) => {
    setLoading(active);
    setLoadingMsg(active ? msg : "");
    if (active) setError("");
  };

  const createRoom = async () => {
    if (!CONTRACT_ADDRESS) { setError(envError); return; }
    if (!nameConfirmed || !playerName.trim()) { setError("Please enter your name first."); return; }
    doLoading("Creating room on GenLayer...", true);
    try {
      // create_room returns the room code
      const code = await writeContractWithReturn("create_room", [playerAddress, playerName]);
      setRoomCode(code);
      await fetchRoom(code);
      setScreen("lobby");
    } catch (err: any) {
      console.error("Create room error:", err);
      setError(`Failed to create room: ${err?.message || "Unknown error"}`);
    } finally {
      doLoading("", false);
    }
  };

  const joinRoom = async (code: string) => {
    if (!CONTRACT_ADDRESS) { setError(envError); return; }
    if (!nameConfirmed || !playerName.trim()) { setError("Please enter your name first."); return; }
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    doLoading("Joining room...", true);
    try {
      await writeContract("join_room", [trimmed, playerAddress, playerName]);
      setRoomCode(trimmed);
      await fetchRoom(trimmed);
      setScreen("lobby");
    } catch (err: any) {
      console.error("Join room error:", err);
      setError(`Failed to join room: ${err?.message || "Unknown error"}`);
    } finally {
      doLoading("", false);
    }
  };

  const toggleReady = async () => {
    if (!CONTRACT_ADDRESS || !roomCode) return;
    doLoading("Toggling ready...", true);
    try {
      await writeContract("toggle_ready", [roomCode, playerAddress]);
      await fetchRoom(roomCode);
    } catch (err: any) {
      setError(`Failed to toggle ready: ${err?.message || "Unknown error"}`);
    } finally {
      doLoading("", false);
    }
  };

  const startGame = async () => {
    if (!CONTRACT_ADDRESS || !roomCode) return;
    doLoading("Starting game on GenLayer...", true);
    try {
      await writeContract("start_game", [roomCode, playerAddress]);
      await fetchRoom(roomCode);
    } catch (err: any) {
      setError(`Failed to start game: ${err?.message || "Unknown error"}`);
    } finally {
      doLoading("", false);
    }
  };

  const submitTake = async () => {
    if (!CONTRACT_ADDRESS || !roomCode || selectedScenario === null || !stance || !hotTake.trim()) return;
    doLoading("Submitting your hot take...", true);
    try {
      await writeContract("submit_take", [roomCode, playerAddress, selectedScenario, stance, hotTake]);
      setSubmitted(true);
    } catch (err: any) {
      setError(`Failed to submit take: ${err?.message || "Unknown error"}`);
    } finally {
      doLoading("", false);
    }
  };

  const advanceToVoting = async () => {
    if (!CONTRACT_ADDRESS || !roomCode) return;
    doLoading("Advancing to voting phase...", true);
    try {
      await writeContract("advance_to_voting", [roomCode]);
      await fetchRoom(roomCode);
    } catch (err: any) {
      setError(`Failed to advance: ${err?.message || "Unknown error"}`);
    } finally {
      doLoading("", false);
    }
  };

  const submitVotes = async () => {
    if (!CONTRACT_ADDRESS || !roomCode) return;
    doLoading("Submitting votes...", true);
    try {
      const votesArray = Object.values(myVotes);
      await writeContract("submit_votes", [roomCode, playerAddress, JSON.stringify(votesArray)]);
      setVotesSubmitted(true);
    } catch (err: any) {
      setError(`Failed to submit votes: ${err?.message || "Unknown error"}`);
    } finally {
      doLoading("", false);
    }
  };

  const calculateResults = async () => {
    if (!CONTRACT_ADDRESS || !roomCode) return;
    doLoading("AI is judging your takes... (this may take 30-60 seconds)", true);
    try {
      await writeContract("calculate_results", [roomCode]);
      await fetchRoom(roomCode);
    } catch (err: any) {
      setError(`Failed to calculate results: ${err?.message || "Unknown error"}`);
    } finally {
      doLoading("", false);
    }
  };

  const goHome = () => {
    if (pollInterval.current) clearInterval(pollInterval.current);
    setScreen("landing");
    setCurrentRoom(null);
    setRoomCode("");
    setSubmitted(false);
    setVotesSubmitted(false);
    setSelectedScenario(null);
    setStance("");
    setHotTake("");
    setMyVotes({});
    setError("");
    setShowJoinInput(false);
    setJoinCodeInput("");
  };

  // ============================================
  // RENDERS
  // ============================================

  const renderError = () => error ? (
    <div style={{ background: `${C.primary}18`, border: `1px solid ${C.primary}50`, borderRadius: 10, padding: "0.85rem 1.1rem", color: C.primary, fontSize: "0.9rem", marginTop: "1rem" }}>
      ⚠️ {error}
    </div>
  ) : null;

  const renderLoadingOverlay = () => loading ? (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,10,15,0.85)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
      <div style={{ fontSize: "2.5rem", marginBottom: "1.5rem" }} className="spin">🔥</div>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.8rem", letterSpacing: "0.1em", color: C.primary }}>GenLayer</div>
      <div style={{ color: C.muted, marginTop: "0.75rem", fontSize: "0.95rem" }}>{loadingMsg || "Processing..."}</div>
      <div style={{ marginTop: "2rem", color: C.muted, fontSize: "0.8rem" }}>Waiting for consensus...</div>
    </div>
  ) : null;

  const scenarioEmoji = (type: string) => {
    const map: Record<string, string> = { art: "🎨", business: "💼", culture: "🌐", tech: "⚙️", society: "🏛️" };
    return map[type] || "🔥";
  };

  // LANDING
  const renderLanding = () => (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "1rem 2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.6rem", letterSpacing: "0.08em", color: C.text }}>
          🔥 HOT TAKE PROTOCOL
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button className="btn-outline" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }} onClick={() => setScreen("leaderboard")}>🏆 Leaderboard</button>
          <button className="btn-outline" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }} onClick={() => setScreen("stats")}>📊 My Stats</button>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "3rem 1.5rem" }} className="fadeIn">
        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(3rem,10vw,5.5rem)", lineHeight: 0.95, letterSpacing: "0.02em", marginBottom: "1rem" }}>
            <span style={{ color: C.primary }} className="fireGlow">HOT</span>
            <span style={{ color: C.text }}> TAKE</span>
            <br />
            <span style={{ color: C.text }}>PROTOCOL</span>
          </div>
          <p style={{ color: C.muted, fontSize: "1rem", marginTop: "1rem" }}>
            2–5 players · AI judges your takes · Debate on-chain
          </p>
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginTop: "1rem", flexWrap: "wrap" }}>
            <span className="tag tag-fire">GenLayer AI</span>
            <span className="tag tag-green">No Wallet Needed</span>
            <span className="tag tag-gold">~10 Minutes</span>
          </div>
        </div>

        {/* Name input */}
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <div style={{ marginBottom: "0.75rem", fontWeight: 600, fontSize: "0.9rem", color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Your Player Name</div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <input
              type="text"
              placeholder="Enter a name..."
              value={playerName}
              onChange={e => { setPlayerName(e.target.value); if (nameConfirmed) setNameConfirmed(false); }}
              onKeyDown={e => { if (e.key === "Enter" && playerName.trim()) setNameConfirmed(true); }}
              maxLength={24}
            />
            <button
              className="btn-primary"
              style={{ whiteSpace: "nowrap", padding: "0.85rem 1.4rem" }}
              onClick={() => { if (playerName.trim()) setNameConfirmed(true); }}
            >
              {nameConfirmed ? "✓ Set" : "Set Name"}
            </button>
          </div>
          {nameConfirmed && (
            <div style={{ marginTop: "0.75rem", color: C.green, fontSize: "0.85rem" }}>
              ✅ Playing as <strong>{playerName}</strong>
            </div>
          )}
        </div>

        {/* Action buttons */}
        {nameConfirmed && (
          <div className="fadeIn" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "2.5rem" }}>
            <button className="btn-primary" style={{ width: "100%", fontSize: "1.05rem", padding: "1.1rem" }} onClick={createRoom} disabled={loading}>
              🔥 Create Room
            </button>

            {!showJoinInput ? (
              <button className="btn-outline" style={{ width: "100%" }} onClick={() => setShowJoinInput(true)}>
                🚪 Join Room with Code
              </button>
            ) : (
              <div className="fadeIn" style={{ display: "flex", gap: "0.75rem" }}>
                <input
                  type="text"
                  placeholder="Enter room code..."
                  value={joinCodeInput}
                  onChange={e => setJoinCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={e => { if (e.key === "Enter") joinRoom(joinCodeInput); }}
                  maxLength={8}
                  style={{ fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em" }}
                />
                <button className="btn-primary" style={{ whiteSpace: "nowrap" }} onClick={() => joinRoom(joinCodeInput)} disabled={!joinCodeInput.trim()}>
                  Join →
                </button>
                <button className="btn-outline" style={{ padding: "0.85rem" }} onClick={() => { setShowJoinInput(false); setJoinCodeInput(""); }}>✕</button>
              </div>
            )}
          </div>
        )}

        {renderError()}

        {/* Recent Games — loaded from contract */}
        <div style={{ marginTop: "2.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div style={{ fontWeight: 700, fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.06em", color: C.muted }}>Recent Games</div>
            <button onClick={loadRecentGames} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: "0.8rem" }}>↻ Refresh</button>
          </div>
          {recentGames.length === 0 ? (
            <div className="card" style={{ textAlign: "center", color: C.muted, padding: "2rem" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🎮</div>
              No recent games yet. Be the first to play!
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {recentGames.map(game => {
                const winner = game.results?.final_scores
                  ? Object.entries(game.results.final_scores).sort((a: any, b: any) => b[1].total - a[1].total)[0]
                  : null;
                return (
                  <div key={game.game_id} className="card" style={{ padding: "1rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600, color: C.fire }}>#{game.room_code}</span>
                      <span style={{ marginLeft: "0.75rem", color: C.muted, fontSize: "0.85rem" }}>{game.players.length} players</span>
                    </div>
                    <div style={{ color: C.muted, fontSize: "0.85rem" }}>
                      {winner ? `🏆 ${(winner[1] as any).player_name}` : "Completed"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* How to play */}
        <div className="card" style={{ marginTop: "2rem" }}>
          <div style={{ fontWeight: 700, marginBottom: "1rem", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.06em", color: C.muted }}>How It Works</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[
              { step: "1", text: "Host creates a room, 2–4 more players join" },
              { step: "2", text: "Everyone picks a scenario and submits their spiciest take" },
              { step: "3", text: "Vote on each other's takes" },
              { step: "4", text: "AI judges rank every take — highest score wins!" },
            ].map(s => (
              <div key={s.step} style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: `${C.primary}22`, border: `1px solid ${C.primary}44`, color: C.primary, fontWeight: 700, fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{s.step}</div>
                <div style={{ color: C.muted, fontSize: "0.9rem", paddingTop: "0.25rem" }}>{s.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // LOBBY
  const renderLobby = () => {
    if (!currentRoom) return null;
    const isHost = currentRoom.host === playerAddress;
    const readyCount = currentRoom.players.filter(p => p.ready).length;
    const canStart = isHost && currentRoom.players.length >= 3;
    const myPlayer = currentRoom.players.find(p => p.address === playerAddress);

    return (
      <div style={{ minHeight: "100vh", background: C.bg, padding: "2rem 1.5rem" }} className="fadeIn">
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          {/* Room code banner */}
          <div className="card" style={{ textAlign: "center", marginBottom: "1.5rem", background: `linear-gradient(135deg, ${C.primary}18, ${C.fire}10)`, borderColor: `${C.primary}40` }}>
            <div style={{ color: C.muted, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>Room Code — Share with friends</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "3.5rem", letterSpacing: "0.2em", color: C.primary }} className="fireGlow">
              {currentRoom.room_code}
            </div>
            <button
              className="btn-outline"
              style={{ marginTop: "0.75rem", padding: "0.5rem 1.25rem", fontSize: "0.85rem" }}
              onClick={() => navigator.clipboard.writeText(currentRoom.room_code)}
            >
              📋 Copy Code
            </button>
          </div>

          {/* Players */}
          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.25rem" }}>
              <div style={{ fontWeight: 700 }}>Players ({currentRoom.players.length}/5)</div>
              <div style={{ color: C.muted, fontSize: "0.9rem" }}>{readyCount} ready</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {currentRoom.players.map(player => (
                <div key={player.address} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.85rem 1rem", background: player.address === playerAddress ? `${C.primary}12` : C.surface, borderRadius: 10, border: player.address === playerAddress ? `1px solid ${C.primary}40` : `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg, ${C.primary}, ${C.purple})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.9rem" }}>
                      {player.name[0].toUpperCase()}
                    </div>
                    <div>
                      <span style={{ fontWeight: 600 }}>{player.name}</span>
                      {player.address === currentRoom.host && <span className="tag tag-gold" style={{ marginLeft: "0.5rem" }}>HOST</span>}
                      {player.address === playerAddress && <span style={{ marginLeft: "0.5rem", color: C.muted, fontSize: "0.8rem" }}>(you)</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: "0.9rem" }}>
                    {player.ready ? <span style={{ color: C.green }}>✅ Ready</span> : <span style={{ color: C.muted }}>⏳ Waiting</span>}
                  </div>
                </div>
              ))}
              {[...Array(5 - currentRoom.players.length)].map((_, i) => (
                <div key={i} style={{ padding: "0.85rem 1rem", borderRadius: 10, border: `1.5px dashed ${C.border}`, color: C.muted, textAlign: "center", fontSize: "0.9rem" }}>
                  Waiting for player {currentRoom.players.length + i + 1}...
                </div>
              ))}
            </div>
          </div>

          {renderError()}

          {/* Actions */}
          <div style={{ display: "flex", gap: "0.75rem" }}>
            {isHost ? (
              <button className="btn-primary" style={{ flex: 1 }} onClick={startGame} disabled={!canStart || loading}>
                {canStart ? `🚀 Start Game (${readyCount}/${currentRoom.players.length} ready)` : `Need 3+ players (${currentRoom.players.length}/3)`}
              </button>
            ) : (
              <button className={myPlayer?.ready ? "btn-outline" : "btn-primary"} style={{ flex: 1 }} onClick={toggleReady} disabled={loading}>
                {myPlayer?.ready ? "✅ Mark Not Ready" : "✋ Mark Ready"}
              </button>
            )}
            <button className="btn-outline" onClick={goHome}>Leave</button>
          </div>
          {isHost && !canStart && (
            <div style={{ textAlign: "center", color: C.muted, fontSize: "0.85rem", marginTop: "0.75rem" }}>
              Need at least 3 players to start the game
            </div>
          )}
          {!isHost && (
            <div style={{ textAlign: "center", color: C.muted, fontSize: "0.85rem", marginTop: "0.75rem" }}>
              Waiting for host to start...
            </div>
          )}
        </div>
      </div>
    );
  };

  // GAME — Round 1
  const renderRound1 = () => {
    if (!currentRoom) return null;
    const isHost = currentRoom.host === playerAddress;
    const mySubmissionKey = selectedScenario !== null ? `${playerAddress}_${selectedScenario}` : null;
    const hasSubmitted = mySubmissionKey ? !!currentRoom.submissions[mySubmissionKey] : submitted;

    return (
      <div style={{ minHeight: "100vh", background: C.bg, padding: "2rem 1.5rem" }} className="fadeIn">
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.75rem" }}>
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.8rem", letterSpacing: "0.06em", color: C.primary }}>ROUND 1 — YOUR TAKE</div>
              <div style={{ color: C.muted, fontSize: "0.85rem" }}>Room {currentRoom.room_code} · {currentRoom.players.length} players</div>
            </div>
            <span className="tag tag-fire">SUBMISSION PHASE</span>
          </div>

          {/* Scenarios */}
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ color: C.muted, fontWeight: 600, fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.85rem" }}>Choose a Scenario</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.85rem" }}>
              {currentRoom.scenarios.map(scenario => (
                <div
                  key={scenario.id}
                  onClick={() => !hasSubmitted && setSelectedScenario(scenario.id)}
                  style={{
                    background: selectedScenario === scenario.id ? `${C.primary}18` : C.card,
                    border: `1.5px solid ${selectedScenario === scenario.id ? C.primary : C.border}`,
                    borderRadius: 14,
                    padding: "1.25rem",
                    cursor: hasSubmitted ? "default" : "pointer",
                    transition: "all 0.2s",
                    transform: selectedScenario === scenario.id ? "translateY(-2px)" : "none",
                  }}
                >
                  <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>{scenarioEmoji(scenario.type)}</div>
                  <div style={{ fontWeight: 700, marginBottom: "0.4rem" }}>{scenario.title}</div>
                  <div style={{ color: C.muted, fontSize: "0.85rem", marginBottom: "0.75rem" }}>{scenario.description}</div>
                  <div style={{ background: C.surface, borderRadius: 8, padding: "0.6rem 0.75rem", fontSize: "0.82rem", color: C.text, fontStyle: "italic" }}>
                    "{scenario.content}"
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Take form */}
          {selectedScenario !== null && !hasSubmitted && (
            <div className="card fadeIn" style={{ marginBottom: "1.25rem" }}>
              <div style={{ fontWeight: 700, marginBottom: "1rem" }}>Your Hot Take</div>

              {/* Stance */}
              <div style={{ display: "flex", gap: "0.65rem", marginBottom: "1rem" }}>
                {[
                  { value: "genius", label: "🔥 Genius", color: C.fire },
                  { value: "trash", label: "🗑️ Trash", color: C.primary },
                  { value: "spicy", label: "😈 Spicy", color: C.purple },
                ].map(s => (
                  <button
                    key={s.value}
                    onClick={() => setStance(s.value)}
                    style={{
                      flex: 1,
                      padding: "0.75rem",
                      border: `1.5px solid ${stance === s.value ? s.color : C.border}`,
                      background: stance === s.value ? `${s.color}18` : C.surface,
                      borderRadius: 10,
                      cursor: "pointer",
                      fontWeight: 600,
                      color: stance === s.value ? s.color : C.muted,
                      transition: "all 0.2s",
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <textarea
                placeholder="Drop your hottest take (max 100 chars)..."
                value={hotTake}
                onChange={e => { if (e.target.value.length <= 100) setHotTake(e.target.value); }}
                rows={3}
              />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem", marginBottom: "1rem" }}>
                <div style={{ color: hotTake.length > 90 ? C.primary : C.muted, fontSize: "0.82rem" }}>{hotTake.length}/100</div>
              </div>

              {renderError()}

              <button
                className="btn-primary"
                style={{ width: "100%" }}
                onClick={submitTake}
                disabled={!stance || hotTake.length < 10 || loading}
              >
                🔥 Submit Take
              </button>
            </div>
          )}

          {hasSubmitted && (
            <div className="card fadeIn" style={{ textAlign: "center", padding: "2rem", background: `${C.green}10`, borderColor: `${C.green}40` }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>✅</div>
              <div style={{ fontWeight: 700, color: C.green, marginBottom: "0.5rem" }}>Take submitted!</div>
              <div style={{ color: C.muted }}>Waiting for other players...</div>
              {isHost && (
                <button className="btn-outline" style={{ marginTop: "1.25rem" }} onClick={advanceToVoting} disabled={loading}>
                  ➡️ Advance to Voting (Host)
                </button>
              )}
            </div>
          )}

          {selectedScenario === null && (
            <div className="card" style={{ textAlign: "center", color: C.muted, padding: "2rem" }}>
              👆 Select a scenario above to submit your hot take
            </div>
          )}
        </div>
      </div>
    );
  };

  // GAME — Round 2 (Voting)
  const renderRound2 = () => {
    if (!currentRoom) return null;
    const isHost = currentRoom.host === playerAddress;

    // Build list of other players' submissions (not mine)
    const otherSubmissions = Object.entries(currentRoom.submissions)
      .filter(([key]) => !key.startsWith(playerAddress))
      .map(([key, sub]: [string, any]) => ({ key, ...sub }));

    const uniqueOtherPlayers = [...new Set(otherSubmissions.map((s: any) => s.player))];

    return (
      <div style={{ minHeight: "100vh", background: C.bg, padding: "2rem 1.5rem" }} className="fadeIn">
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.75rem" }}>
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.8rem", letterSpacing: "0.06em", color: C.gold }}>ROUND 2 — VOTING</div>
              <div style={{ color: C.muted, fontSize: "0.85rem" }}>Room {currentRoom.room_code}</div>
            </div>
            <span className="tag tag-gold">VOTE PHASE</span>
          </div>

          {!votesSubmitted ? (
            <>
              <div className="card" style={{ marginBottom: "1.5rem" }}>
                <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Vote for the best takes</div>
                <div style={{ color: C.muted, fontSize: "0.9rem" }}>Pick the player(s) whose takes you thought were best. You can vote for multiple players.</div>
              </div>

              {uniqueOtherPlayers.length === 0 ? (
                <div className="card" style={{ textAlign: "center", color: C.muted }}>No submissions from other players yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
                  {uniqueOtherPlayers.map(playerAddr => {
                    const playerSubs = otherSubmissions.filter((s: any) => s.player === playerAddr);
                    const playerNameDisplay = currentRoom.players.find(p => p.address === playerAddr)?.name || playerAddr.slice(0, 8) + "...";
                    const votes = Object.values(myVotes);
                    const isVoted = votes.includes(playerAddr);

                    return (
                      <div
                        key={playerAddr}
                        onClick={() => {
                          setMyVotes(prev => {
                            const newVotes = { ...prev };
                            const idx = Object.values(newVotes).indexOf(playerAddr);
                            if (idx >= 0) {
                              delete newVotes[Object.keys(newVotes)[idx]];
                            } else {
                              newVotes[Date.now()] = playerAddr;
                            }
                            return newVotes;
                          });
                        }}
                        style={{
                          background: isVoted ? `${C.gold}14` : C.card,
                          border: `1.5px solid ${isVoted ? C.gold : C.border}`,
                          borderRadius: 14,
                          padding: "1.25rem",
                          cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                          <div style={{ fontWeight: 700 }}>{playerNameDisplay}</div>
                          {isVoted && <span style={{ color: C.gold, fontSize: "1.2rem" }}>⭐</span>}
                        </div>
                        {playerSubs.map((sub: any) => {
                          const scenario = currentRoom.scenarios[sub.scenario_index];
                          return (
                            <div key={sub.key} style={{ background: C.surface, borderRadius: 8, padding: "0.75rem", marginTop: "0.5rem" }}>
                              <div style={{ fontSize: "0.8rem", color: C.muted, marginBottom: "0.3rem" }}>
                                {scenario?.title} · <span style={{ color: sub.stance === "genius" ? C.fire : sub.stance === "trash" ? C.primary : C.purple }}>
                                  {sub.stance === "genius" ? "🔥 Genius" : sub.stance === "trash" ? "🗑️ Trash" : "😈 Spicy"}
                                </span>
                              </div>
                              <div style={{ fontStyle: "italic", fontSize: "0.9rem" }}>"{sub.take}"</div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}

              {renderError()}

              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  className="btn-gold"
                  style={{ flex: 1 }}
                  onClick={submitVotes}
                  disabled={Object.keys(myVotes).length === 0 || loading}
                >
                  🗳️ Submit Votes ({Object.keys(myVotes).length} selected)
                </button>
                {isHost && (
                  <button className="btn-outline" onClick={calculateResults} disabled={loading}>
                    ⚡ Calculate Results (Host)
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="card" style={{ textAlign: "center", padding: "2.5rem", background: `${C.gold}10`, borderColor: `${C.gold}40` }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🗳️</div>
              <div style={{ fontWeight: 700, color: C.gold, marginBottom: "0.5rem" }}>Votes submitted!</div>
              <div style={{ color: C.muted }}>Waiting for all players to vote...</div>
              {isHost && (
                <button className="btn-gold" style={{ marginTop: "1.25rem" }} onClick={calculateResults} disabled={loading}>
                  ⚡ Calculate Final Results (Host)
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderGame = () => {
    if (!currentRoom) return null;
    if (currentRoom.status === "round_1") return renderRound1();
    if (currentRoom.status === "round_2") return renderRound2();
    return null;
  };

  // RESULTS
  const renderResults = () => {
    if (!currentRoom || !currentRoom.results) {
      return (
        <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3rem" }} className="spin">🔥</div>
            <div style={{ color: C.muted, marginTop: "1rem" }}>Calculating results...</div>
          </div>
        </div>
      );
    }

    const scores = currentRoom.results.final_scores || {};
    const sorted = Object.entries(scores).sort((a: any, b: any) => b[1].total - a[1].total);
    const aiRankings = currentRoom.results.ai_rankings || {};

    return (
      <div style={{ minHeight: "100vh", background: C.bg, padding: "2rem 1.5rem" }} className="fadeIn">
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(2.5rem,8vw,4.5rem)", letterSpacing: "0.05em" }}>
              <span style={{ color: C.gold }} className="fireGlow">GAME OVER</span>
            </div>
            <div style={{ color: C.muted, marginTop: "0.5rem" }}>Room {currentRoom.room_code}</div>
          </div>

          {/* Podium */}
          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontWeight: 700, marginBottom: "1.25rem", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.06em", color: C.muted }}>Final Standings</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              {sorted.map(([address, data]: [string, any], i) => {
                const medals = ["🥇", "🥈", "🥉"];
                const isMe = address === playerAddress;
                const isWinner = i === 0;
                return (
                  <div key={address} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "1rem 1.25rem",
                    borderRadius: 12,
                    background: isWinner ? `linear-gradient(135deg, ${C.gold}25, ${C.fire}15)` : isMe ? `${C.primary}12` : C.surface,
                    border: `1.5px solid ${isWinner ? C.gold + "60" : isMe ? C.primary + "50" : C.border}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                      <div style={{ fontSize: "1.3rem" }}>{medals[i] || `${i + 1}.`}</div>
                      <div>
                        <div style={{ fontWeight: 700 }}>
                          {data.player_name}
                          {isMe && <span style={{ color: C.muted, fontWeight: 400, fontSize: "0.8rem" }}> (you)</span>}
                        </div>
                        <div style={{ color: C.muted, fontSize: "0.78rem" }}>AI: {data.ai_points}pts · Vote bonus: {data.vote_bonus}pts</div>
                      </div>
                    </div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.8rem", color: isWinner ? C.gold : C.text, letterSpacing: "0.05em" }}>
                      {data.total}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Reasoning */}
          {Object.keys(aiRankings).length > 0 && (
            <div className="card" style={{ marginBottom: "1.5rem" }}>
              <div style={{ fontWeight: 700, marginBottom: "1rem", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.06em", color: C.muted }}>🤖 AI Judge Reasoning</div>
              {Object.entries(aiRankings).map(([scenarioKey, rankings]: [string, any]) => {
                const scenarioIdx = parseInt(scenarioKey.replace("scenario_", ""));
                const scenario = currentRoom.scenarios[scenarioIdx];
                return (
                  <div key={scenarioKey} style={{ marginBottom: "1rem" }}>
                    <div style={{ fontWeight: 600, marginBottom: "0.5rem", color: C.fire }}>{scenario?.title || scenarioKey}</div>
                    {Array.isArray(rankings) && rankings.map((rank: any) => {
                      const pName = currentRoom.players.find(p => p.address === rank.player)?.name || rank.player?.slice(0, 8) + "...";
                      return (
                        <div key={rank.player} style={{ display: "flex", gap: "0.75rem", padding: "0.65rem 0.85rem", background: C.surface, borderRadius: 8, marginBottom: "0.4rem" }}>
                          <div style={{ color: rank.rank === 1 ? C.gold : C.muted, fontWeight: 700, minWidth: 20 }}>#{rank.rank}</div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{pName} · <span style={{ color: C.muted, fontWeight: 400 }}>{rank.score}pts</span></div>
                            <div style={{ color: C.muted, fontSize: "0.82rem", marginTop: "0.2rem" }}>{rank.reasoning}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn-primary" style={{ flex: 1 }} onClick={createRoom} disabled={loading}>🔥 Play Again</button>
            <button className="btn-outline" onClick={goHome}>🏠 Home</button>
          </div>
        </div>
      </div>
    );
  };

  // STATS
  const renderStats = () => {
    const [myStats, setMyStats] = useState<any>(null);
    const [statsLoading, setStatsLoading] = useState(true);

    useEffect(() => {
      if (!CONTRACT_ADDRESS || !playerAddress) { setStatsLoading(false); return; }
      readContract("get_player_stats", [playerAddress])
        .then(raw => { if (raw) setMyStats(JSON.parse(raw as string)); })
        .catch(() => {})
        .finally(() => setStatsLoading(false));
    }, []);

    return (
      <div style={{ minHeight: "100vh", background: C.bg, padding: "2rem 1.5rem" }} className="fadeIn">
        <div style={{ maxWidth: 580, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2rem", letterSpacing: "0.06em" }}>MY STATS</div>
            <button className="btn-outline" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }} onClick={goHome}>← Back</button>
          </div>

          {statsLoading ? (
            <div className="card" style={{ textAlign: "center", padding: "3rem", color: C.muted }}>
              <div className="spin" style={{ fontSize: "2rem" }}>🔥</div>
              <div style={{ marginTop: "1rem" }}>Loading stats...</div>
            </div>
          ) : myStats ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                {[
                  { label: "Games Played", value: myStats.games_played, icon: "🎮" },
                  { label: "Wins", value: myStats.wins, icon: "🏆" },
                  { label: "Total Points", value: myStats.total_points, icon: "🔥" },
                  { label: "Win Rate", value: myStats.games_played > 0 ? `${Math.round(myStats.wins / myStats.games_played * 100)}%` : "—", icon: "📊" },
                ].map(stat => (
                  <div key={stat.label} className="card" style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>{stat.icon}</div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2rem", color: C.primary }}>{stat.value}</div>
                    <div style={{ color: C.muted, fontSize: "0.85rem" }}>{stat.label}</div>
                  </div>
                ))}
              </div>
              {myStats.best_performance && (
                <div className="card" style={{ background: `${C.gold}10`, borderColor: `${C.gold}40` }}>
                  <div style={{ color: C.gold, fontWeight: 700, marginBottom: "0.5rem" }}>🏅 Best Performance</div>
                  <div style={{ color: C.muted, fontSize: "0.9rem" }}>Score: <strong style={{ color: C.text }}>{myStats.best_performance.score} pts</strong> in Game #{myStats.best_performance.game_id}</div>
                </div>
              )}
            </>
          ) : (
            <div className="card" style={{ textAlign: "center", color: C.muted, padding: "3rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🎮</div>
              {playerAddress ? "No games played yet. Get in there!" : "Set your name to view stats."}
            </div>
          )}
        </div>
      </div>
    );
  };

  // LEADERBOARD
  const renderLeaderboard = () => (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "2rem 1.5rem" }} className="fadeIn">
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2rem", letterSpacing: "0.06em" }}>🏆 LEADERBOARD</div>
          <div style={{ display: "flex", gap: "0.65rem" }}>
            <button className="btn-outline" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }} onClick={loadLeaderboard}>↻ Refresh</button>
            <button className="btn-outline" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }} onClick={goHome}>← Back</button>
          </div>
        </div>

        {leaderboard.length === 0 ? (
          <div className="card" style={{ textAlign: "center", color: C.muted, padding: "3rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🏆</div>
            No players on the leaderboard yet. Play some games!
          </div>
        ) : (
          <div className="card">
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {leaderboard.map((entry, i) => {
                const medals = ["🥇", "🥈", "🥉"];
                const isMe = entry.address === playerAddress;
                return (
                  <div key={entry.address} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.9rem 1rem",
                    borderRadius: 10,
                    background: isMe ? `${C.primary}12` : i === 0 ? `${C.gold}10` : C.surface,
                    border: `1px solid ${isMe ? C.primary + "40" : i === 0 ? C.gold + "40" : C.border}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                      <div style={{ fontSize: "1.2rem", minWidth: 28 }}>{medals[i] || `${i + 1}.`}</div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                          {entry.address.slice(0, 10)}...
                          {isMe && <span style={{ color: C.muted, fontWeight: 400, fontSize: "0.78rem" }}> (you)</span>}
                        </div>
                        <div style={{ color: C.muted, fontSize: "0.78rem" }}>{entry.games_played} games · {entry.wins} wins</div>
                      </div>
                    </div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.5rem", color: i === 0 ? C.gold : C.text }}>
                      {entry.total_points} <span style={{ fontSize: "0.7rem", color: C.muted }}>pts</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderScreen = () => {
    if (envError) return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div className="card" style={{ maxWidth: 540, textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚠️</div>
          <div style={{ fontWeight: 700, color: C.primary, marginBottom: "0.75rem" }}>Configuration Error</div>
          <div style={{ color: C.muted, marginBottom: "1rem" }}>{envError}</div>
          <code style={{ display: "block", background: C.surface, padding: "0.75rem", borderRadius: 8, fontSize: "0.85rem", color: C.text }}>
            NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
          </code>
        </div>
      </div>
    );

    switch (screen) {
      case "landing": return renderLanding();
      case "lobby": return renderLobby();
      case "game": return renderGame();
      case "results": return renderResults();
      case "stats": return renderStats();
      case "leaderboard": return renderLeaderboard();
      default: return renderLanding();
    }
  };

  return (
    <>
      <style>{css}</style>
      {renderLoadingOverlay()}
      {renderScreen()}
    </>
  );
}

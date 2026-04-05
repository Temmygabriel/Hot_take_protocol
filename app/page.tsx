"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

// ============================================
// TYPES
// ============================================
type Screen = "landing" | "lobby" | "game" | "results" | "stats" | "leaderboard" | "lookup";
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
  bots_ready?: boolean; // v0.3: bots generated in separate tx
}

// ============================================
// CONTRACT HELPERS
// ============================================
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
const MAX_ATTEMPTS = 3;

let sessionAccount: ReturnType<typeof createAccount> | null = null;

function getSessionAccount() {
  if (!sessionAccount) sessionAccount = createAccount();
  return sessionAccount;
}

function makeClient() {
  const account = getSessionAccount();
  const client = createClient({ chain: studionet, account });
  return { client, account };
}

async function readContract(functionName: string, args: any[]): Promise<any> {
  const { client } = makeClient();
  return await client.readContract({ address: CONTRACT_ADDRESS, functionName, args });
}

async function writeContract(functionName: string, args: any[]): Promise<boolean> {
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
        retries: 120,
        interval: 4000,
      });
      return true;
    } catch (err: any) {
      console.error(`writeContract ${functionName} attempt ${attempt} failed:`, err?.message);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, attempt * 5000));
        continue;
      }
      throw err;
    }
  }
  return false;
}

async function writeContractWithReturn(functionName: string, args: any[]): Promise<string> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { client } = makeClient();
      const returnValue = await client.simulateWriteContract({
        address: CONTRACT_ADDRESS,
        functionName,
        args,
      });
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName,
        args,
        leaderOnly: false,
      } as any);
      await client.waitForTransactionReceipt({
        hash,
        status: TransactionStatus.ACCEPTED,
        retries: 120,
        interval: 4000,
      });
      return returnValue as string;
    } catch (err: any) {
      console.error(`writeContractWithReturn ${functionName} attempt ${attempt} failed:`, err?.message);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, attempt * 5000));
        continue;
      }
      throw err;
    }
  }
  throw new Error("All attempts failed");
}

// ============================================
// HELPERS
// ============================================
function allVotesIn(room: Room): boolean {
  const humanPlayers = room.players.filter((p) => !p.address.startsWith("bot_"));
  return humanPlayers.length > 0 && humanPlayers.every((p) => room.votes[p.address]);
}

// Timestamp (ms) when we first detected all votes were in.
// Used for the host-dropout fallback: if the host hasn't fired
// calculate_results within CALCULATE_TIMEOUT_MS, any player can step up.
let allVotesDetectedAt: number | null = null;
const CALCULATE_TIMEOUT_MS = 30_000; // 30 seconds grace period for host

// Timestamp (ms) when we first detected all takes were submitted in round_1.
// If after ADVANCE_TIMEOUT_MS the host hasn't called advance_to_voting,
// any player can step up — prevents game stall when someone never submits
// (host can also manually force-advance via the UI button).
let allSubmittedDetectedAt: number | null = null;
const ADVANCE_TIMEOUT_MS = 60_000; // 60 seconds before any player can step up

// ============================================
// COLORS
// ============================================
const C = {
  bg: "#F5F7FA",
  surface: "#FFFFFF",
  card: "#FFFFFF",
  border: "#E2E8F0",
  text: "#1A202C",
  muted: "#718096",
  primary: "#FF3D00",
  secondary: "#00E676",
  fire: "#FF6D00",
  gold: "#FFD600",
  purple: "#D500F9",
  shadow: "0 2px 8px rgba(0,0,0,0.08)",
  shadowHover: "0 4px 16px rgba(0,0,0,0.12)",
};

const AI_TIPS = [
  "⚡ GenLayer validators are reading your takes...",
  "🤖 Multiple AI models are reaching consensus...",
  "🧠 Arguments are being scored for persuasiveness...",
  "⚖️ Creativity and clarity are being evaluated...",
  "🔥 The hotter the take, the longer it simmers...",
  "📡 Optimistic Democracy is finalizing the verdict...",
  "🌐 5 AI validators must agree before results unlock...",
  "🎯 Ranking takes from spiciest to mildest...",
  "💬 AI judges are debating your arguments right now...",
];

// ============================================
// CSS
// ============================================
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Bebas+Neue&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${C.bg}; color: ${C.text}; font-family: 'Space Grotesk', sans-serif; line-height: 1.6; }
  ::placeholder { color: ${C.muted}; }
  ::-webkit-scrollbar { width: 8px; }
  ::-webkit-scrollbar-track { background: ${C.bg}; }
  ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: ${C.muted}; }

  input, textarea {
    background: ${C.surface}; color: ${C.text};
    border: 2px solid ${C.border}; border-radius: 12px;
    padding: 0.9rem 1.1rem; font-family: 'Space Grotesk', sans-serif;
    font-size: 1rem; outline: none; transition: all 0.2s; width: 100%;
  }
  input:focus, textarea:focus { border-color: ${C.primary}; box-shadow: 0 0 0 3px ${C.primary}20; }
  textarea { resize: vertical; min-height: 100px; }

  .card {
    background: ${C.card}; border: 1.5px solid ${C.border};
    border-radius: 16px; padding: 1.75rem;
    box-shadow: ${C.shadow}; transition: all 0.3s ease;
  }
  .card:hover { box-shadow: ${C.shadowHover}; }

  .btn-primary {
    background: linear-gradient(135deg, ${C.primary}, ${C.fire});
    color: white; border: none; border-radius: 12px;
    padding: 0.95rem 1.75rem; font-weight: 700; font-size: 1rem;
    cursor: pointer; transition: all 0.2s; box-shadow: ${C.shadow};
    font-family: 'Space Grotesk', sans-serif;
  }
  .btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: ${C.shadowHover}; }
  .btn-primary:active:not(:disabled) { transform: translateY(0); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-outline {
    background: transparent; color: ${C.text};
    border: 2px solid ${C.border}; border-radius: 12px;
    padding: 0.9rem 1.5rem; font-weight: 600; font-size: 1rem;
    cursor: pointer; transition: all 0.2s; font-family: 'Space Grotesk', sans-serif;
  }
  .btn-outline:hover:not(:disabled) { border-color: ${C.primary}; color: ${C.primary}; background: ${C.primary}08; }
  .btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-secondary {
    background: ${C.secondary}; color: #1A202C; border: none; border-radius: 12px;
    padding: 0.95rem 1.75rem; font-weight: 700; font-size: 1rem;
    cursor: pointer; transition: all 0.2s; box-shadow: ${C.shadow};
    font-family: 'Space Grotesk', sans-serif;
  }
  .btn-secondary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: ${C.shadowHover}; }
  .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

  .stance-genius { background: linear-gradient(135deg, ${C.gold}, ${C.fire}); color: #1A202C; }
  .stance-trash { background: #CBD5E0; color: #1A202C; }
  .stance-spicy { background: linear-gradient(135deg, ${C.purple}, ${C.primary}); color: white; }

  .fadeIn { animation: fadeIn 0.4s ease-in; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .pulse { animation: pulse 2s infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  .spin { animation: spin 1s linear infinite; display: inline-block; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .slide-up { animation: slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
  @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }

  .hero-badge {
    display: inline-flex; align-items: center; gap: 6px;
    background: ${C.primary}12; border: 1px solid ${C.primary}30;
    border-radius: 100px; padding: 6px 16px; font-size: 0.78rem;
    font-weight: 600; color: ${C.primary}; letter-spacing: 0.04em;
    text-transform: uppercase; margin-bottom: 1.5rem;
  }
  .hero-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(3.5rem, 10vw, 6rem);
    line-height: 0.92; letter-spacing: -0.01em; color: ${C.text}; margin-bottom: 1.5rem;
  }
  .hero-title .highlight {
    background: linear-gradient(135deg, ${C.primary}, ${C.purple});
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  .hero-subtitle { font-size: 1.1rem; color: ${C.muted}; margin-bottom: 2.5rem; line-height: 1.7; }
  .stat-chip {
    display: inline-flex; flex-direction: column; align-items: center;
    padding: 0.75rem 1.25rem; background: ${C.surface};
    border: 1.5px solid ${C.border}; border-radius: 12px; gap: 2px; min-width: 80px;
  }
  .stat-chip .num { font-family: 'Bebas Neue', sans-serif; font-size: 1.6rem; color: ${C.primary}; line-height: 1; }
  .stat-chip .lbl { font-size: 0.7rem; color: ${C.muted}; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
  .name-input-row { display: flex; gap: 0.75rem; align-items: stretch; margin-bottom: 0.75rem; }
  .name-input-row input { margin: 0; flex: 1; }
  .set-btn {
    background: ${C.text}; color: white; border: none; border-radius: 12px;
    padding: 0 1.25rem; font-weight: 700; font-size: 0.9rem;
    cursor: pointer; white-space: nowrap; font-family: 'Space Grotesk', sans-serif; transition: background 0.2s;
  }
  .set-btn:hover { background: #2D3748; }
  .divider-row {
    display: flex; align-items: center; gap: 1rem;
    color: ${C.muted}; font-size: 0.85rem; margin: 0.25rem 0;
  }
  .divider-row::before, .divider-row::after { content: ''; flex: 1; height: 1px; background: ${C.border}; }
  .action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 0.75rem; }

  .ai-dots span {
    display: inline-block; width: 8px; height: 8px; border-radius: 50%;
    background: ${C.purple}; margin: 0 3px;
    animation: dotBounce 1.2s infinite;
  }
  .ai-dots span:nth-child(2) { animation-delay: 0.2s; }
  .ai-dots span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes dotBounce { 0%,80%,100% { transform: scale(0.8); opacity: 0.5; } 40% { transform: scale(1.2); opacity: 1; } }

  .voted-chip {
    display: inline-flex; align-items: center; gap: 4px;
    background: ${C.secondary}20; border: 1px solid ${C.secondary}40;
    color: #00a65a; border-radius: 8px; padding: 2px 8px; font-size: 0.75rem; font-weight: 700;
  }
  .pending-chip {
    display: inline-flex; align-items: center; gap: 4px;
    background: ${C.muted}15; border: 1px solid ${C.border};
    color: ${C.muted}; border-radius: 8px; padding: 2px 8px; font-size: 0.75rem; font-weight: 600;
  }
  .bots-loading-bar {
    height: 4px; border-radius: 2px; background: ${C.border};
    overflow: hidden; margin-top: 0.5rem;
  }
  .bots-loading-bar-fill {
    height: 100%; background: linear-gradient(90deg, ${C.purple}, ${C.primary});
    animation: barSlide 2s ease-in-out infinite;
  }
  @keyframes barSlide { 0% { width: 0%; margin-left: 0; } 50% { width: 60%; margin-left: 20%; } 100% { width: 0%; margin-left: 100%; } }
`;

// ============================================
// MAIN COMPONENT
// ============================================
export default function HotTakeProtocol() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [nameLocked, setNameLocked] = useState(false);
  const [tipIdx, setTipIdx] = useState(0);

  const [playerName, setPlayerName] = useState("");
  const [playerAddress, setPlayerAddress] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  // Lookup screen state
  const [lookupCode, setLookupCode] = useState("");
  const [lookupRoom, setLookupRoom] = useState<Room | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);

  // Game state
  const [selectedScenario, setSelectedScenario] = useState<number | null>(null);
  const [selectedStance, setSelectedStance] = useState<string>("");
  const [takeText, setTakeText] = useState("");
  const [votes, setVotes] = useState<Record<string, string>>({});

  // Manual refresh fallback — for non-host players waiting on results
  const [waitingForResults, setWaitingForResults] = useState(false);
  const [manualRefreshRoom, setManualRefreshRoom] = useState<string>("");
  const [waitingSecondsLeft, setWaitingSecondsLeft] = useState(30);

  // Refs to avoid stale closures in polling
  const screenRef = useRef<Screen>("landing");
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollRoomCodeRef = useRef<string>("");
  const playerAddressRef = useRef<string>("");
  // Prevents duplicate calculate_results calls — only host triggers it, once
  const calculatingRef = useRef(false);
  // Prevents duplicate advance_to_voting calls — host triggers once when all submitted
  const advancingRef = useRef(false);
  // Prevents duplicate generate_bot_takes calls
  const generatingBotsRef = useRef(false);

  useEffect(() => { screenRef.current = screen; }, [screen]);
  useEffect(() => { playerAddressRef.current = playerAddress; }, [playerAddress]);

  // Rotate tips while loading overlay is visible
  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setTipIdx((i) => (i + 1) % AI_TIPS.length), 3500);
    return () => clearInterval(t);
  }, [loading]);

  useEffect(() => {
    // Restore or create the session account.
    // IMPORTANT: persist the address in localStorage so that if the player
    // gets kicked (network drop, tab refresh) they come back as the same address
    // and can rejoin mid-game. Without this, createAccount() generates a fresh
    // address each session, making them look like a new unknown player.
    const saved = localStorage.getItem("htp_player_address");
    const { account } = makeClient();
    if (saved && saved !== account.address) {
      // The account object is derived from a stored key — if we saved one before,
      // we need to ensure the same key is used. For studionet (no real private keys),
      // the best we can do is save the address and show it to the user for lookup.
      // The genlayer-js createAccount() is deterministic per-browser if we seed it,
      // but since we can't control that, we save what we got and use it consistently.
      localStorage.setItem("htp_player_address", account.address);
    } else if (!saved) {
      localStorage.setItem("htp_player_address", account.address);
    }
    setPlayerAddress(account.address);
    loadLeaderboard();
  }, []);

  useEffect(() => {
    const n = localStorage.getItem("htp_player_name");
    if (n) { setPlayerName(n); setNameLocked(true); }
  }, []);

  const lockName = () => {
    if (playerName.trim()) {
      localStorage.setItem("htp_player_name", playerName.trim());
      setNameLocked(true);
    }
  };

  const loadLeaderboard = async () => {
    try {
      const raw = await readContract("get_global_leaderboard", []);
      if (raw) setLeaderboard(JSON.parse(raw as string));
    } catch { /* silent */ }
  };

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
    pollRoomCodeRef.current = "";
    calculatingRef.current = false;
    advancingRef.current = false;
    generatingBotsRef.current = false;
  }, []);

  const goHome = useCallback(() => {
    stopPolling();
    setScreen("landing");
    setCurrentRoom(null);
    setRoomCode("");
    setSelectedScenario(null);
    setSelectedStance("");
    setTakeText("");
    setVotes({});
    setWaitingForResults(false);
    setManualRefreshRoom("");
    setWaitingSecondsLeft(30);
    allVotesDetectedAt = null;
    allSubmittedDetectedAt = null;
  }, [stopPolling]);

  // ─────────────────────────────────────────────────────────
  // POLLING ENGINE — v0.3 changes:
  //
  // 1. HOST ONLY triggers calculate_results (once, guarded by calculatingRef)
  // 2. After submitting votes, non-hosts show a "waiting for AI" state with
  //    a manual Refresh button in case they've been waiting too long
  // 3. Solo mode: after start_game, automatically calls generate_bot_takes
  //    as a background transaction. Shows "AI bots preparing..." inline.
  // 4. Always fetches a fresh room before navigating to results.
  // ─────────────────────────────────────────────────────────
  const startPolling = useCallback((code: string) => {
    stopPolling();
    pollRoomCodeRef.current = code;
    calculatingRef.current = false;
    advancingRef.current = false;
    generatingBotsRef.current = false;
    allVotesDetectedAt = null;
    allSubmittedDetectedAt = null;

    const interval = setInterval(async () => {
      if (pollRoomCodeRef.current !== code) return;
      const cs = screenRef.current;
      if (!["lobby", "game"].includes(cs)) return;

      try {
        const raw = await readContract("get_room", [code]);
        if (!raw || pollRoomCodeRef.current !== code) return;
        const room = JSON.parse(raw as string) as Room;
        const myAddr = playerAddressRef.current;
        const isHost = room.host === myAddr;
        const isSolo = room.solo_mode === true;

        // ── Lobby → Game: non-host detected host started ──
        if (room.status === "round_1" && cs === "lobby") {
          setCurrentRoom(room);
          setScreen("game");
          return;
        }

        // ── ROUND 1: detect all-submitted → host (or fallback) calls advance_to_voting ──
        if (room.status === "round_1" && cs === "game" && !advancingRef.current) {
          const allSubmitted = room.players.every((p: Player) =>
            Object.keys(room.submissions).some((k) => k.startsWith(p.address))
          );
          if (allSubmitted) {
            if (!allSubmittedDetectedAt) allSubmittedDetectedAt = Date.now();
            const elapsed = Date.now() - (allSubmittedDetectedAt ?? Date.now());
            const isHost = room.host === myAddr;
            const shouldAdvance = isHost || elapsed >= ADVANCE_TIMEOUT_MS;
            if (shouldAdvance) {
              advancingRef.current = true;
              setLoading(true);
              setLoadingMessage(
                isHost
                  ? "All takes in — advancing to voting round..."
                  : "Host offline — stepping up to advance game..."
              );
              try {
                await writeContract("advance_to_voting", [code]);
                const freshRaw = await readContract("get_room", [code]);
                if (freshRaw && pollRoomCodeRef.current === code) {
                  setCurrentRoom(JSON.parse(freshRaw as string));
                }
              } catch (err: any) {
                console.error("advance_to_voting failed:", err?.message);
                advancingRef.current = false;
                allSubmittedDetectedAt = null;
              } finally {
                setLoading(false);
                setLoadingMessage("");
              }
              return;
            }
            // Not host, timer hasn't elapsed — keep room fresh so UI shows countdown
          } else {
            allSubmittedDetectedAt = null;
          }
        }

        // ── SOLO BOT TAKES: trigger generate_bot_takes once in background ──
        if (isSolo && room.status === "round_1" && room.bots_ready === false && !generatingBotsRef.current) {
          generatingBotsRef.current = true;
          try {
            await writeContract("generate_bot_takes", [code]);
            const freshRaw = await readContract("get_room", [code]);
            if (freshRaw && pollRoomCodeRef.current === code) {
              setCurrentRoom(JSON.parse(freshRaw as string));
            }
          } catch (err: any) {
            console.error("generate_bot_takes failed:", err?.message);
            generatingBotsRef.current = false;
          }
          return;
        }

        // ── Completed: navigate everyone to results ──
        // NOTE: check this BEFORE the round_2 block so a rejoined
        // non-host who missed the calculate step still gets results.
        if (room.status === "completed") {
          if (cs !== "results") {
            const freshRaw = await readContract("get_room", [code]);
            const finalRoom = freshRaw ? JSON.parse(freshRaw as string) : room;
            setCurrentRoom(finalRoom);
            setWaitingForResults(false);
            stopPolling();
            setScreen("results");
          }
          return;
        }

        // ── Round 2 logic ──
        if (room.status === "round_2") {
          // Keep UI in sync (render voting screen or "voted, waiting" screen)
          setCurrentRoom(room);

          if (allVotesIn(room) && !calculatingRef.current) {
            // Record when we first noticed all votes were in
            if (!allVotesDetectedAt) allVotesDetectedAt = Date.now();

            const elapsed = Date.now() - (allVotesDetectedAt ?? Date.now());
            // HOST fires immediately. Any player can step up after the timeout
            // — this handles host network dropout without killing the game.
            const shouldCalculate = isHost || elapsed >= CALCULATE_TIMEOUT_MS;

            if (shouldCalculate) {
              calculatingRef.current = true;
              setLoading(true);
              setLoadingMessage(
                isHost
                  ? "All votes in — AI judges are calculating results..."
                  : "Host seems offline — stepping up to calculate results..."
              );
              setWaitingForResults(false);
              try {
                await writeContract("calculate_results", [code]);
                // DO NOT stop polling here. Just let the "completed" check above
                // handle navigation on the next poll tick. This prevents the case
                // where calculate_results succeeds but the room hasn't flipped to
                // "completed" yet — if we stop polling now the player is stuck forever.
                // calculatingRef stays true so we don't double-fire.
                setLoading(false);
                setLoadingMessage("");
                writeContract("finalize_game", [code]).catch((e) =>
                  console.warn("finalize_game failed (non-critical):", e?.message)
                );
              } catch (err: any) {
                console.error("calculate_results failed:", err?.message);
                calculatingRef.current = false;
                allVotesDetectedAt = null; // reset so fallback retries
                setLoading(false);
                setLoadingMessage("");
              }
              return;
            }

            // Not host, timer hasn't elapsed yet — show waiting overlay ONLY if player already voted
            const myVotedAlready = !!(room.votes[myAddr]);
            if (myVotedAlready) {
              const secondsLeft = Math.ceil((CALCULATE_TIMEOUT_MS - elapsed) / 1000);
              setManualRefreshRoom(code);
              setWaitingForResults(true);
              setWaitingSecondsLeft(secondsLeft);
            }
          } else if (!allVotesIn(room)) {
            // Votes still coming in — hide waiting overlay if shown
            allVotesDetectedAt = null;
            setWaitingForResults(false);
          }
          return;
        }

        // Default: keep room state fresh (lobby, round_1)
        setCurrentRoom(room);
      } catch (err) {
        console.error("Poll error:", err);
      }
    }, 3000);

    pollIntervalRef.current = interval;
  }, [stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // Manual refresh / step-up for non-host players
  // If all votes are in and status is still round_2, this player triggers calculate_results.
  const manualRefreshResults = async () => {
    const code = manualRefreshRoom || roomCode;
    if (!code) return;
    setLoading(true);
    setLoadingMessage("Checking for results...");
    try {
      const raw = await readContract("get_room", [code]);
      if (!raw) return;
      const room = JSON.parse(raw as string) as Room;

      if (room.status === "completed" && room.results?.final_scores) {
        setCurrentRoom(room);
        setWaitingForResults(false);
        stopPolling();
        setScreen("results");
        return;
      }

      // If all votes are in but still round_2, step up and trigger calculate_results
      if (room.status === "round_2" && allVotesIn(room) && !calculatingRef.current) {
        calculatingRef.current = true;
        setLoadingMessage("Stepping up — AI judges calculating results...");
        setWaitingForResults(false);
        await writeContract("calculate_results", [code]);
        // Don't stop polling — let the "completed" check in the polling loop
        // handle navigation. The room may not be "completed" immediately after the tx.
        writeContract("finalize_game", [code]).catch((e) =>
          console.warn("finalize_game failed (non-critical):", e?.message)
        );
        return;
      }

      // Votes still coming in — just update state
      setCurrentRoom(room);
    } catch (err: any) {
      console.error("manualRefreshResults failed:", err?.message);
      calculatingRef.current = false;
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  // ─────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────

  const createRoom = async () => {
    if (!playerName.trim()) { alert("Please enter your name first!"); return; }
    setLoading(true); setLoadingMessage("Creating room...");
    try {
      localStorage.setItem("htp_player_name", playerName.trim());
      const code = await writeContractWithReturn("create_room", [playerAddress, playerName.trim()]);
      setRoomCode(code);
      const raw = await readContract("get_room", [code]);
      if (raw) { setCurrentRoom(JSON.parse(raw as string)); setScreen("lobby"); startPolling(code); }
    } catch (err: any) { alert(`Failed to create room: ${err.message}`); }
    finally { setLoading(false); setLoadingMessage(""); }
  };

  const createSoloRoom = async () => {
    if (!playerName.trim()) { alert("Please enter your name first!"); return; }
    setLoading(true); setLoadingMessage("Creating Solo Arena...");
    try {
      localStorage.setItem("htp_player_name", playerName.trim());
      const code = await writeContractWithReturn("create_solo_room", [playerAddress, playerName.trim()]);
      setRoomCode(code);
      const raw = await readContract("get_room", [code]);
      if (raw) { setCurrentRoom(JSON.parse(raw as string)); setScreen("lobby"); startPolling(code); }
    } catch (err: any) { alert(`Failed to create solo room: ${err.message}`); }
    finally { setLoading(false); setLoadingMessage(""); }
  };

  const joinRoom = async () => {
    if (!playerName.trim() || !roomCode.trim()) { alert("Please enter your name and room code!"); return; }
    setLoading(true); setLoadingMessage("Joining room...");
    try {
      localStorage.setItem("htp_player_name", playerName.trim());
      const code = roomCode.trim().toUpperCase();
      await writeContract("join_room", [code, playerAddress, playerName.trim()]);
      const raw = await readContract("get_room", [code]);
      if (raw) { setCurrentRoom(JSON.parse(raw as string)); setScreen("lobby"); startPolling(code); }
    } catch (err: any) { alert(`Failed to join room: ${err.message}`); }
    finally { setLoading(false); setLoadingMessage(""); }
  };

  const toggleReady = async () => {
    if (!currentRoom) return;
    setLoading(true);
    try {
      await writeContract("toggle_ready", [currentRoom.room_code, playerAddress]);
      const raw = await readContract("get_room", [currentRoom.room_code]);
      if (raw) setCurrentRoom(JSON.parse(raw as string));
    } catch (err: any) { alert(`Failed: ${err.message}`); }
    finally { setLoading(false); }
  };

  const startGame = async () => {
    if (!currentRoom) return;
    const isSolo = currentRoom.solo_mode === true;
    setLoading(true);
    setLoadingMessage(
      isSolo
        ? "Generating AI debate scenarios... (~30-60s) — bot takes load after"
        : "Generating debate scenarios with AI... (~30-60s)"
    );
    try {
      await writeContract("start_game", [currentRoom.room_code, playerAddress]);
      const raw = await readContract("get_room", [currentRoom.room_code]);
      if (raw) {
        const room = JSON.parse(raw as string);
        setCurrentRoom(room);
        if (room.status === "round_1") setScreen("game");
        // In solo mode, generate_bot_takes fires automatically from the polling loop
      }
    } catch (err: any) { alert(`Failed to start game: ${err.message}`); }
    finally { setLoading(false); setLoadingMessage(""); }
  };

  const submitTake = async () => {
    if (!currentRoom || selectedScenario === null || !selectedStance || !takeText.trim()) {
      alert("Please select a scenario, stance, and write your take!");
      return;
    }
    setLoading(true); setLoadingMessage("Submitting your hot take...");
    try {
      await writeContract("submit_take", [
        currentRoom.room_code, playerAddress, selectedScenario, selectedStance, takeText.trim(),
      ]);
      const raw = await readContract("get_room", [currentRoom.room_code]);
      if (raw) {
        const room = JSON.parse(raw as string) as Room;
        setCurrentRoom(room);
        // NOTE: advance_to_voting is now triggered by the polling loop
        // (host fires when all submitted, non-host fallback after ADVANCE_TIMEOUT_MS).
        // This prevents the old bug where the last submitter's tx failure = everyone stuck.
      }
    } catch (err: any) { alert(`Failed to submit take: ${err.message}`); }
    finally { setLoading(false); setLoadingMessage(""); }
  };

  // ─────────────────────────────────────────────────────────
  // SUBMIT VOTES — ONLY submits the vote. Does NOT call calculate_results.
  //
  // The polling loop handles calculate_results:
  // - HOST fires it once when allVotesIn() is true (guarded by calculatingRef)
  // - NON-HOSTS wait via polling and get a manual Refresh fallback button
  // ─────────────────────────────────────────────────────────
  const submitVotes = async () => {
    if (!currentRoom) return;
    if (Object.keys(votes).length === 0) { alert("Please vote for at least one take!"); return; }
    setLoading(true); setLoadingMessage("Submitting your votes...");
    try {
      await writeContract("submit_votes", [
        currentRoom.room_code, playerAddress, JSON.stringify(Object.values(votes)),
      ]);
      const raw = await readContract("get_room", [currentRoom.room_code]);
      if (raw) setCurrentRoom(JSON.parse(raw as string));
    } catch (err: any) { alert(`Failed to submit votes: ${err.message}`); }
    finally { setLoading(false); setLoadingMessage(""); }
  };

  const lookupGame = async () => {
    if (!lookupCode.trim()) return;
    setLookupLoading(true); setLookupError(""); setLookupRoom(null);
    try {
      const raw = await readContract("get_room", [lookupCode.trim().toUpperCase()]);
      if (raw && raw !== "") setLookupRoom(JSON.parse(raw as string));
      else setLookupError("Room not found. Check the code and try again.");
    } catch { setLookupError("Room not found. Check the code and try again."); }
    finally { setLookupLoading(false); }
  };

  const rejoinFromLookup = (room: Room) => {
    setCurrentRoom(room);
    setRoomCode(room.room_code);
    if (room.status === "completed") { setScreen("results"); }
    else if (["round_1", "round_2"].includes(room.status)) { setScreen("game"); startPolling(room.room_code); }
    else { setScreen("lobby"); startPolling(room.room_code); }
  };

  const copyRoomCode = () => {
    if (currentRoom) { navigator.clipboard.writeText(currentRoom.room_code); alert("Room code copied!"); }
  };

  // ─────────────────────────────────────────────────────────
  // RENDER FUNCTIONS
  // ─────────────────────────────────────────────────────────

  const renderLoadingOverlay = () => {
    if (!loading) return null;
    return (
      <div style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 9999, backdropFilter: "blur(4px)",
      }}>
        <div className="card" style={{ textAlign: "center", minWidth: 320, maxWidth: 420 }}>
          <div className="spin" style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔥</div>
          <div style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: "0.4rem" }}>{loadingMessage || "Loading..."}</div>
          <div style={{ color: C.muted, fontSize: "0.82rem", marginBottom: "0.5rem" }}>Do not close this tab</div>
          {(loadingMessage.includes("AI") || loadingMessage.includes("scenario") || loadingMessage.includes("calculating") || loadingMessage.includes("bot")) && (
            <div style={{ fontSize: "0.75rem", color: C.muted, marginBottom: "1rem", padding: "0.5rem 0.75rem", background: `${C.gold}10`, borderRadius: 8, border: `1px solid ${C.gold}20` }}>
              ⏱ GenLayer runs 5+ AI validators in consensus — results take 30-90s by design. Faster than any human jury!
            </div>
          )}
          <div style={{
            background: `${C.primary}08`, border: `1px solid ${C.primary}20`,
            borderRadius: 10, padding: "0.75rem 1rem",
            fontSize: "0.8rem", color: C.primary, fontStyle: "italic", transition: "all 0.3s",
          }}>
            {AI_TIPS[tipIdx]}
          </div>
        </div>
      </div>
    );
  };

  // ── WAITING FOR RESULTS overlay (non-host fallback) ──
  const renderWaitingForResults = () => {
    if (!waitingForResults) return null;
    return (
      <div style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 9000, backdropFilter: "blur(4px)",
      }}>
        <div className="card" style={{ textAlign: "center", minWidth: 320, maxWidth: 420 }}>
          <div style={{ border: `2px solid ${C.purple}30`, borderRadius: 12, padding: "1.5rem", marginBottom: "1.25rem" }}>
            <div className="ai-dots" style={{ marginBottom: "1.25rem", display: "flex", justifyContent: "center" }}>
              <span /><span /><span />
            </div>
            <div style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: "0.5rem" }}>All votes are in!</div>
            <div style={{ color: C.muted, fontSize: "0.85rem", marginBottom: "0.75rem" }}>
              Waiting for the host to trigger AI judging...
            </div>
            {waitingSecondsLeft > 0 ? (
              <div style={{ fontSize: "0.82rem", color: C.fire }}>
                If host is offline, you can step up in <strong>{waitingSecondsLeft}s</strong>
              </div>
            ) : (
              <div style={{ fontSize: "0.82rem", color: C.secondary, fontWeight: 700 }}>
                ✓ You can now trigger results yourself
              </div>
            )}
          </div>
          <div style={{ color: C.muted, fontSize: "0.8rem", marginBottom: "1rem" }}>
            {AI_TIPS[tipIdx]}
          </div>
          <button className="btn-outline" onClick={manualRefreshResults} disabled={loading}
            style={{ width: "100%", marginBottom: "0.65rem" }}>
            🔄 Check for Results
          </button>
          <button className="btn-outline" onClick={goHome} style={{ width: "100%", fontSize: "0.85rem", padding: "0.7rem" }}>
            ← Back to Home
          </button>
        </div>
      </div>
    );
  };

  const renderLanding = () => (
    <div style={{ minHeight: "100vh", background: C.bg }} className="fadeIn">
      <div style={{
        background: "linear-gradient(160deg, #fff 0%, #FFF5F2 60%, #F5F7FA 100%)",
        borderBottom: `1px solid ${C.border}`, padding: "4rem 1.5rem 3rem",
      }}>
        <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
          <div className="hero-badge"><span>🔥</span> Powered by GenLayer AI</div>
          <h1 className="hero-title">
            DROP YOUR<br />
            <span className="highlight">HOT TAKES</span><br />
            OWN THE ROOM
          </h1>
          <p className="hero-subtitle">
            A 5-player debate game where AI judges your arguments.<br />
            The spiciest take wins.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", marginBottom: "3rem", flexWrap: "wrap" }}>
            {[["5","Players"],["3","Rounds"],["AI","Judges"],["10m","Per Game"]].map(([n,l]) => (
              <div key={l} className="stat-chip"><span className="num">{n}</span><span className="lbl">{l}</span></div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <div style={{ fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted, marginBottom: "0.85rem" }}>Your Player Name</div>
          <div className="name-input-row">
            <input type="text" placeholder="Enter your name..." value={playerName}
              onChange={(e) => { setPlayerName(e.target.value); setNameLocked(false); }}
              onKeyDown={(e) => e.key === "Enter" && lockName()} disabled={nameLocked} />
            {nameLocked
              ? <button className="set-btn" style={{ background: C.secondary, color: C.text }} onClick={() => setNameLocked(false)}>✏️ Edit</button>
              : <button className="set-btn" onClick={lockName}>Set →</button>
            }
          </div>
          {nameLocked && <div style={{ fontSize: "0.8rem", color: C.secondary, fontWeight: 600, marginTop: "0.4rem" }}>✓ Ready as <strong>{playerName}</strong></div>}
        </div>

        <button className="btn-primary" onClick={createRoom} disabled={loading || !playerName.trim()}
          style={{ width: "100%", marginBottom: "0.75rem", padding: "1.1rem" }}>
          🔥 CREATE NEW ROOM
        </button>

        <div style={{ display: "flex", gap: "0.6rem", marginBottom: "0.75rem" }}>
          <input type="text" placeholder="Room code..." value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && joinRoom()} style={{ flex: 1, margin: 0 }} />
          <button className="btn-outline" onClick={joinRoom}
            disabled={loading || !playerName.trim() || !roomCode.trim()}
            style={{ whiteSpace: "nowrap", padding: "0.9rem 1.2rem" }}>JOIN</button>
        </div>

        <div className="divider-row">or play solo</div>

        <button className="btn-secondary" onClick={createSoloRoom} disabled={loading || !playerName.trim()}
          style={{ width: "100%", marginBottom: "1.75rem", padding: "1rem" }}>
          🤖 SOLO ARENA — Play vs AI Bots
        </button>

        <div className="action-grid">
          <button className="btn-outline" onClick={() => setScreen("stats")} style={{ textAlign: "center", padding: "0.85rem" }}>📊 My Stats</button>
          <button className="btn-outline" onClick={() => setScreen("leaderboard")} style={{ textAlign: "center", padding: "0.85rem" }}>🏆 Leaderboard</button>
        </div>

        <button className="btn-outline" onClick={() => setScreen("lookup")}
          style={{ width: "100%", marginTop: "0.75rem", padding: "0.85rem", textAlign: "center", fontSize: "0.9rem" }}>
          🔍 Check Game Status / Rejoin
        </button>

        <div style={{ marginTop: "1.25rem", textAlign: "center", color: C.muted, fontSize: "0.78rem" }}>
          Your ID: <code style={{ color: C.text }}>{playerAddress ? playerAddress.slice(0, 14) + "..." : "—"}</code>
        </div>
      </div>
    </div>
  );

  const renderLobby = () => {
    if (!currentRoom) return null;
    const isHost = currentRoom.host === playerAddress;
    const isSolo = currentRoom.solo_mode === true;
    const canStart = isHost && currentRoom.players.length >= (isSolo ? 1 : 3);
    const myPlayer = currentRoom.players.find((p) => p.address === playerAddress);

    return (
      <div style={{ minHeight: "100vh", background: C.bg, padding: "2rem 1.5rem" }} className="fadeIn">
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2rem", letterSpacing: "0.06em" }}>{isSolo ? "SOLO ARENA" : "LOBBY"}</div>
              <div style={{ color: C.muted, fontSize: "0.9rem" }}>Room: <strong style={{ letterSpacing: "0.08em" }}>{currentRoom.room_code}</strong></div>
            </div>
            <div style={{ display: "flex", gap: "0.65rem" }}>
              {!isSolo && <button className="btn-outline" onClick={copyRoomCode} style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>📋 Copy Code</button>}
              <button className="btn-outline" onClick={goHome} style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>← Leave</button>
            </div>
          </div>

          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontWeight: 700, marginBottom: "1.25rem" }}>Players ({currentRoom.players.length}/5)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {currentRoom.players.map((p) => (
                <div key={p.address} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "0.9rem 1rem", borderRadius: 10,
                  background: p.address === playerAddress ? `${C.primary}10` : C.bg,
                  border: `1.5px solid ${p.address === playerAddress ? C.primary + "40" : C.border}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div style={{ fontSize: "1.5rem" }}>{p.address.startsWith("bot_") ? "🤖" : "👤"}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                        {p.name}
                        {p.address === currentRoom.host && <span style={{ color: C.fire, marginLeft: "0.4rem", fontSize: "0.78rem" }}>👑 HOST</span>}
                        {p.address === playerAddress && <span style={{ color: C.muted, marginLeft: "0.4rem", fontSize: "0.75rem" }}>(you)</span>}
                      </div>
                      <div style={{ color: C.muted, fontSize: "0.78rem" }}>{p.address.startsWith("bot_") ? "AI Bot" : p.address.slice(0, 12) + "..."}</div>
                    </div>
                  </div>
                  <div>{p.ready ? <span style={{ color: C.secondary, fontWeight: 700, fontSize: "0.85rem" }}>✓ READY</span> : <span style={{ color: C.muted, fontSize: "0.85rem" }}>Waiting...</span>}</div>
                </div>
              ))}
            </div>
          </div>

          {!isSolo && (
            <div className="card" style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>Ready up?</div>
                  <div style={{ color: C.muted, fontSize: "0.85rem" }}>Let the host know you're ready to play</div>
                </div>
                <button className="btn-outline" onClick={toggleReady} disabled={loading}
                  style={{ borderColor: myPlayer?.ready ? C.secondary : C.border, color: myPlayer?.ready ? C.secondary : C.text }}>
                  {myPlayer?.ready ? "✓ Ready!" : "Mark Ready"}
                </button>
              </div>
            </div>
          )}

          {isHost && (
            <div className="card">
              <button className="btn-primary" onClick={startGame}
                disabled={!canStart || loading} style={{ width: "100%", padding: "1.1rem", marginBottom: "0.75rem" }}>
                {currentRoom.players.length < (isSolo ? 1 : 3) ? `Need ${isSolo ? 1 : 3}+ players to start` : "🚀 START GAME"}
              </button>
              <div style={{ color: C.muted, fontSize: "0.8rem", textAlign: "center" }}>
                {isSolo
                  ? "⚡ Start generates AI scenarios (~30-60s). Bot takes load separately in the background."
                  : "⚡ Start generates AI scenarios for all players (~30-60s on studionet)."}
              </div>
            </div>
          )}
          {!isHost && (
            <div className="card" style={{ textAlign: "center", color: C.muted }}>
              <div className="pulse">⏳ Waiting for host to start the game...</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderGame = () => {
    if (!currentRoom) return null;
    const mySubmission = Object.entries(currentRoom.submissions).find(([key]) => key.startsWith(playerAddress));
    const hasSubmitted = !!mySubmission;
    const isRound1 = currentRoom.status === "round_1";
    const isRound2 = currentRoom.status === "round_2";
    const isSolo = currentRoom.solo_mode === true;
    const myVoted = !!(currentRoom.votes[playerAddress]);

    // ── SOLO: bots still loading ──
    const botsStillLoading = isSolo && isRound1 && currentRoom.bots_ready === false;

    return (
      <div style={{ minHeight: "100vh", background: C.bg, padding: "2rem 1.5rem" }} className="fadeIn">
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2rem", letterSpacing: "0.06em" }}>
              {isRound1 ? "ROUND 1: HOT TAKES" : "ROUND 2: VOTING"}
            </div>
            <div style={{ color: C.muted, fontSize: "0.85rem" }}>Room: {currentRoom.room_code}</div>
          </div>

          {/* ── SOLO BOTS LOADING BANNER ── */}
          {botsStillLoading && (
            <div style={{
              padding: "0.85rem 1.1rem", marginBottom: "1.25rem", borderRadius: 12,
              background: `${C.purple}08`, border: `1.5px solid ${C.purple}25`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                <span style={{ fontWeight: 600, fontSize: "0.88rem", color: C.purple }}>🤖 AI bots are preparing their takes...</span>
                <span style={{ fontSize: "0.75rem", color: C.muted }}>~30-60s</span>
              </div>
              <div className="bots-loading-bar"><div className="bots-loading-bar-fill" /></div>
              <div style={{ fontSize: "0.78rem", color: C.muted, marginTop: "0.4rem" }}>You can write your take now — bots will be ready before voting starts.</div>
            </div>
          )}

          {/* ────── ROUND 1 ────── */}
          {isRound1 && (
            <>
              {!hasSubmitted ? (
                <>
                  <div className="card" style={{ marginBottom: "1.5rem" }}>
                    <div style={{ fontWeight: 700, marginBottom: "1.25rem" }}>Choose Your Scenario</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                      {currentRoom.scenarios.map((s, i) => (
                        <div key={i} onClick={() => setSelectedScenario(i)} style={{
                          padding: "1rem 1.25rem", borderRadius: 12, cursor: "pointer",
                          border: `2px solid ${selectedScenario === i ? C.primary : C.border}`,
                          background: selectedScenario === i ? `${C.primary}08` : C.surface,
                          transition: "all 0.2s",
                        }}>
                          <div style={{ fontWeight: 700, marginBottom: "0.3rem", color: selectedScenario === i ? C.primary : C.text }}>{s.title}</div>
                          <div style={{ fontSize: "0.85rem", color: C.muted }}>{s.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedScenario !== null && (
                    <div className="card slide-up" style={{ marginBottom: "1.5rem" }}>
                      <div style={{ fontWeight: 700, marginBottom: "1rem" }}>Your Stance</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "1.25rem" }}>
                        {[
                          { value: "genius", label: "🔥 Genius", cls: "stance-genius" },
                          { value: "trash", label: "🗑️ Trash", cls: "stance-trash" },
                          { value: "spicy", label: "😈 Spicy", cls: "stance-spicy" },
                        ].map(({ value, label, cls }) => (
                          <div key={value} onClick={() => setSelectedStance(value)} className={cls} style={{
                            padding: "0.85rem", borderRadius: 10, textAlign: "center",
                            fontWeight: 700, fontSize: "0.9rem", cursor: "pointer",
                            border: `2px solid ${selectedStance === value ? "#1A202C" : "transparent"}`,
                            opacity: selectedStance === value ? 1 : 0.7, transition: "all 0.2s",
                          }}>{label}</div>
                        ))}
                      </div>

                      <div style={{ fontWeight: 700, marginBottom: "0.75rem" }}>
                        Your Take <span style={{ color: C.muted, fontWeight: 400 }}>(200 chars max)</span>
                      </div>
                      <textarea
                        placeholder="Write your hot take — be persuasive, creative, and spicy..."
                        value={takeText}
                        onChange={(e) => setTakeText(e.target.value.slice(0, 200))}
                        style={{ marginBottom: "0.5rem", minHeight: 90 }}
                      />
                      <div style={{
                        textAlign: "right", fontSize: "0.85rem", marginBottom: "1rem",
                        color: takeText.length > 180 ? C.fire : C.muted,
                        fontWeight: takeText.length > 180 ? 700 : 400,
                      }}>{takeText.length}/200</div>
                      <button className="btn-primary" onClick={submitTake}
                        disabled={!selectedStance || !takeText.trim() || loading} style={{ width: "100%" }}>
                        🔥 Submit Take
                      </button>
                    </div>
                  )}
                </>
              ) : (() => {
                const submittedCount = currentRoom.players.filter((p) =>
                  Object.keys(currentRoom.submissions).some((k) => k.startsWith(p.address))
                ).length;
                const totalCount = currentRoom.players.length;
                const allIn = submittedCount >= totalCount;
                return (
                  <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
                    {allIn ? (
                      <>
                        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔥</div>
                        <div style={{ fontWeight: 700, fontSize: "1.25rem", marginBottom: "0.5rem" }}>All Takes Are In!</div>
                        <div style={{ color: C.muted, fontSize: "0.88rem", marginBottom: "1.5rem" }}>
                          The debate floor is set. Launching voting round...
                        </div>
                        <div style={{ border: `2px solid ${C.primary}30`, background: `${C.primary}06`, borderRadius: 12, padding: "1.25rem", marginBottom: "1.25rem" }}>
                          <div style={{ fontWeight: 700, color: C.primary, marginBottom: "0.4rem" }}>Heads up!</div>
                          <div style={{ color: C.muted, fontSize: "0.82rem" }}>
                            The voting screen is loading — this takes a moment on GenLayer.
                            Do not close your tab. You will be moved automatically.
                          </div>
                        </div>
                        <div className="ai-dots" style={{ display: "flex", justifyContent: "center" }}><span /><span /><span /></div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✅</div>
                        <div style={{ fontWeight: 700, fontSize: "1.25rem", marginBottom: "0.75rem" }}>Take Submitted!</div>
                        <div style={{ color: C.muted, marginBottom: "1rem" }}>Waiting for other players...</div>
                        <div style={{ marginBottom: "1.5rem" }}>
                          {currentRoom.players.map((p) => {
                            const submitted = Object.keys(currentRoom.submissions).some((k) => k.startsWith(p.address));
                            return (
                              <div key={p.address} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.4rem 0", borderBottom: `1px solid ${C.border}` }}>
                                <span style={{ fontSize: "0.88rem" }}>{p.name}{p.address === playerAddress ? " (you)" : ""}</span>
                                {submitted
                                  ? <span className="voted-chip">✓ Submitted</span>
                                  : <span className="pending-chip">Writing...</span>}
                              </div>
                            );
                          })}
                        </div>
                        {/* Host force-advance button — lets host skip a player who isn't submitting */}
                        {currentRoom.host === playerAddress && (
                          <div style={{ marginBottom: "1.25rem" }}>
                            <button
                              className="btn-outline"
                              style={{ width: "100%", fontSize: "0.85rem", padding: "0.75rem", borderColor: C.fire, color: C.fire }}
                              disabled={loading}
                              onClick={async () => {
                                setLoading(true);
                                setLoadingMessage("Force-advancing to voting...");
                                try {
                                  advancingRef.current = true;
                                  await writeContract("advance_to_voting", [currentRoom.room_code]);
                                  const raw2 = await readContract("get_room", [currentRoom.room_code]);
                                  if (raw2) setCurrentRoom(JSON.parse(raw2 as string));
                                } catch (e: any) {
                                  advancingRef.current = false;
                                  alert(`Failed: ${e.message}`);
                                } finally {
                                  setLoading(false);
                                  setLoadingMessage("");
                                }
                              }}>
                              ⏩ Skip & Advance to Voting (Host Only)
                            </button>
                            <div style={{ fontSize: "0.75rem", color: C.muted, marginTop: "0.4rem" }}>
                              Use this if someone is taking too long or disconnected.
                            </div>
                          </div>
                        )}
                        {mySubmission && (
                          <div style={{ textAlign: "left", padding: "0.85rem 1rem", background: C.bg, borderRadius: 10, border: `1px solid ${C.border}` }}>
                            <div style={{ fontSize: "0.78rem", color: C.muted, marginBottom: "0.3rem" }}>Your take:</div>
                            <div style={{ fontStyle: "italic", fontSize: "0.88rem" }}>&ldquo;{mySubmission[1]?.take}&rdquo;</div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}
            </>
          )}

          {/* ────── ROUND 2: VOTING ────── */}
          {isRound2 && (
            <>
              {!myVoted ? (
                <>
                  <div style={{ marginBottom: "1rem", padding: "0.85rem 1rem", background: `${C.gold}10`, border: `1px solid ${C.gold}30`, borderRadius: 10, fontSize: "0.85rem" }}>
                    🗳️ Vote for up to <strong>3 best takes</strong>. Your votes add bonus points to the final score.
                  </div>

                  <div className="card" style={{ marginBottom: "1.5rem" }}>
                    <div style={{ fontWeight: 700, marginBottom: "1.25rem" }}>All Takes — Tap to Vote</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                      {currentRoom.players
                        .filter((p) => {
                          // ── KEY FIX: in solo mode show bot takes for voting ──
                          // Previously bots were filtered out → blank voting screen in solo.
                          // In solo: show ALL takes except your own (including bots).
                          // In multiplayer: show other human players only.
                          if (isSolo) return p.address !== playerAddress;
                          return p.address !== playerAddress && !p.address.startsWith("bot_");
                        })
                        .map((p) => {
                          const submission = Object.entries(currentRoom.submissions).find(([key]) => key.startsWith(p.address));
                          if (!submission) return null;
                          const [, data] = submission;
                          const scenario = currentRoom.scenarios[data.scenario_index];
                          const isVoted = Object.values(votes).includes(p.address);
                          const maxReached = Object.keys(votes).length >= 3 && !isVoted;

                          return (
                            <div key={p.address} onClick={() => {
                              if (maxReached) return;
                              const nv = { ...votes };
                              const ek = Object.keys(nv).find((k) => nv[k] === p.address);
                              if (ek) delete nv[ek]; else nv[Date.now().toString()] = p.address;
                              setVotes(nv);
                            }} style={{
                              padding: "1rem 1.25rem", borderRadius: 12, cursor: maxReached ? "default" : "pointer",
                              border: `2px solid ${isVoted ? C.primary : C.border}`,
                              background: isVoted ? `${C.primary}08` : C.surface,
                              opacity: maxReached ? 0.45 : 1, transition: "all 0.2s",
                            }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                                    {p.name}
                                    {p.address.startsWith("bot_") && <span style={{ color: C.purple, marginLeft: "0.4rem", fontSize: "0.75rem" }}>🤖 AI</span>}
                                  </div>
                                  <div style={{ fontSize: "0.78rem", color: C.muted }}>{scenario?.title}</div>
                                </div>
                                <div className={`stance-${data.stance}`} style={{ padding: "0.35rem 0.65rem", borderRadius: 8, fontSize: "0.75rem", fontWeight: 700 }}>
                                  {data.stance === "genius" ? "🔥 Genius" : data.stance === "trash" ? "🗑️ Trash" : "😈 Spicy"}
                                </div>
                              </div>
                              <div style={{ fontSize: "0.9rem", fontStyle: "italic" }}>&ldquo;{data.take}&rdquo;</div>
                              {isVoted && <div style={{ marginTop: "0.5rem" }}><span className="voted-chip">✓ Voted</span></div>}
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  <div style={{ textAlign: "center", color: C.muted, fontSize: "0.85rem", marginBottom: "1rem" }}>
                    {Object.keys(votes).length}/3 votes cast
                  </div>
                  <button className="btn-primary" onClick={submitVotes}
                    disabled={Object.keys(votes).length === 0 || loading} style={{ width: "100%" }}>
                    Submit Votes ({Object.keys(votes).length})
                  </button>
                </>
              ) : (
                // Voted — waiting for others + AI to calculate
                <div className="card" style={{ textAlign: "center", padding: "2.5rem" }}>
                  <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🗳️</div>
                  <div style={{ fontWeight: 700, fontSize: "1.2rem", marginBottom: "1.25rem" }}>Votes Submitted!</div>

                  {/* Per-player vote status */}
                  <div style={{ marginBottom: "1.5rem", textAlign: "left" }}>
                    {currentRoom.players.filter((p) => !p.address.startsWith("bot_")).map((p) => (
                      <div key={p.address} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: `1px solid ${C.border}` }}>
                        <span style={{ fontSize: "0.88rem" }}>{p.name}{p.address === playerAddress ? " (you)" : ""}</span>
                        {currentRoom.votes[p.address]
                          ? <span className="voted-chip">✓ Voted</span>
                          : <span className="pending-chip">Pending...</span>
                        }
                      </div>
                    ))}
                  </div>

                  {(() => {
                    const humanPlayers = currentRoom.players.filter((p) => !p.address.startsWith("bot_"));
                    const allVoted = humanPlayers.every((p) => currentRoom.votes[p.address]);
                    return allVoted ? (
                      <div style={{ border: `2px solid ${C.fire}40`, background: `${C.fire}06`, borderRadius: 12, padding: "1.5rem" }}>
                        <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🤖⚖️</div>
                        <div style={{ fontWeight: 700, marginBottom: "0.5rem", color: C.fire }}>AI Judges Are Working!</div>
                        <div style={{ color: C.muted, fontSize: "0.82rem", marginBottom: "1rem" }}>
                          All votes are in. The AI panel is now evaluating every take and writing
                          personalised reasoning. This takes 60-90 seconds on GenLayer — hang tight!
                        </div>
                        <div style={{ fontSize: "0.78rem", color: C.muted, marginBottom: "1rem", fontStyle: "italic" }}>
                          {AI_TIPS[tipIdx]}
                        </div>
                        <div className="ai-dots"><span /><span /><span /></div>
                      </div>
                    ) : (
                      <div style={{ border: `2px solid ${C.purple}30`, background: `${C.purple}06`, borderRadius: 12, padding: "1.5rem" }}>
                        <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Waiting for all players to vote...</div>
                        <div style={{ color: C.muted, fontSize: "0.82rem", marginBottom: "1rem" }}>
                          Once everyone votes, AI judges will evaluate all takes and calculate final scores.
                        </div>
                        <div className="ai-dots"><span /><span /><span /></div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const renderResults = () => {
    if (!currentRoom) return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <div className="spin" style={{ fontSize: "2rem", marginBottom: "1rem" }}>🔥</div>
          <div style={{ fontWeight: 700 }}>Loading results...</div>
        </div>
      </div>
    );

    if (!currentRoom.results?.final_scores) return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
        <div className="card" style={{ textAlign: "center", padding: "3rem", maxWidth: 380 }}>
          <div className="ai-dots" style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "center" }}><span /><span /><span /></div>
          <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>AI is finalizing scores...</div>
          <div style={{ color: C.muted, fontSize: "0.85rem", marginBottom: "1.25rem" }}>This page will update automatically.</div>
          <button className="btn-outline" onClick={manualRefreshResults} disabled={loading}
            style={{ width: "100%", fontSize: "0.85rem", padding: "0.75rem" }}>
            🔄 Refresh
          </button>
        </div>
      </div>
    );

    const { final_scores, ai_rankings } = currentRoom.results;
    const sorted = Object.entries(final_scores || {})
      .map(([addr, d]: [string, any]) => ({ address: addr, ...d }))
      .sort((a: any, b: any) => b.total - a.total);
    const iWon = sorted[0]?.address === playerAddress;

    return (
      <div style={{ minHeight: "100vh", background: C.bg, padding: "2rem 1.5rem" }} className="fadeIn">
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>{iWon ? "🏆" : "🔥"}</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "3rem", letterSpacing: "0.06em" }}>
              {iWon ? "VICTORY!" : "GAME OVER"}
            </div>
            <div style={{ color: C.muted, marginTop: "0.5rem", fontSize: "0.85rem" }}>
              Room: <strong>{currentRoom.room_code}</strong> · {currentRoom.solo_mode ? "Solo Arena" : "Multiplayer"}
            </div>
          </div>

          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontWeight: 700, marginBottom: "1.25rem" }}>🏅 Final Scores</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {sorted.map((s: any, i: number) => {
                const isMe = s.address === playerAddress;
                return (
                  <div key={s.address} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "1rem 1.25rem", borderRadius: 12,
                    background: isMe ? `${C.primary}10` : i === 0 ? `${C.gold}10` : C.bg,
                    border: `2px solid ${isMe ? C.primary + "40" : i === 0 ? C.gold + "40" : C.border}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                      <div style={{ fontSize: "1.5rem", minWidth: 32 }}>{["🥇","🥈","🥉"][i] || `${i+1}.`}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                          {s.player_name}{isMe && <span style={{ color: C.muted, fontSize: "0.8rem" }}> (you)</span>}
                        </div>
                        <div style={{ fontSize: "0.78rem", color: C.muted }}>AI: {s.ai_points}pts · Vote bonus: +{s.vote_bonus}</div>
                      </div>
                    </div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.75rem", color: i === 0 ? C.gold : C.text }}>{s.total}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {ai_rankings && (
            <div className="card" style={{ marginBottom: "1.5rem" }}>
              <div style={{ fontWeight: 700, marginBottom: "1rem" }}>🤖 AI Judge Reasoning</div>
              {Object.entries(ai_rankings).map(([key, rankings]: [string, any]) => {
                const idx = parseInt(key.replace("scenario_", ""));
                // Find by scenario.id, NOT array index — IDs may not match position
                const sc = currentRoom.scenarios.find((s) => s.id === idx) || currentRoom.scenarios[idx];
                return (
                  <div key={key} style={{ marginBottom: "1.25rem" }}>
                    <div style={{ fontWeight: 700, marginBottom: "0.5rem", color: C.fire, fontSize: "0.9rem" }}>{sc?.title || key}</div>
                    {Array.isArray(rankings) && rankings.map((r: any) => {
                      // Fuzzy match: contract may store truncated address in r.player
                      const matched = currentRoom.players.find((p) =>
                        p.address === r.player ||
                        p.address.startsWith(r.player) ||
                        r.player.startsWith(p.address.slice(0, 12))
                      );
                      const pn = matched?.name || r.player?.slice(0, 8) + "...";
                      const isBot = matched?.address?.startsWith("bot_") || false;
                      const scenarioIdx = parseInt(key.replace("scenario_", ""));
                      const theirTake = matched
                        ? (Object.values(currentRoom.submissions) as any[]).find(
                            (s: any) => (s.player === matched.address || matched.address.startsWith(s.player)) && s.scenario_index === scenarioIdx
                          )
                        : null;
                      return (
                        <div key={r.player} style={{ display: "flex", gap: "0.75rem", padding: "0.85rem 1rem", background: C.bg, borderRadius: 10, marginBottom: "0.6rem", border: `1px solid ${r.rank === 1 ? C.gold + "40" : C.border}` }}>
                          <div style={{ color: r.rank === 1 ? C.gold : C.muted, fontWeight: 800, minWidth: 28, fontSize: "1rem" }}>#{r.rank}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.2rem" }}>
                              {isBot && <span style={{ marginRight: "0.3rem" }}>🤖</span>}
                              {pn}
                              <span style={{ color: C.muted, fontWeight: 400, marginLeft: "0.5rem", fontSize: "0.85rem" }}>{r.score}pts</span>
                            </div>
                            {theirTake && (
                              <div style={{ fontSize: "0.78rem", color: C.fire, fontStyle: "italic", marginBottom: "0.35rem" }}>
                                &ldquo;{theirTake.take?.slice(0, 90)}{theirTake.take?.length > 90 ? "..." : ""}&rdquo;
                              </div>
                            )}
                            <div style={{ color: C.muted, fontSize: "0.82rem" }}>
                              {r.reasoning === "AI evaluation unavailable - fallback score."
                                ? "⚠️ AI consensus timed out for this round — scores are equal. Try a rematch!"
                                : r.reasoning}
                            </div>
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

  const renderLookup = () => (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "2rem 1.5rem" }} className="fadeIn">
      <div style={{ maxWidth: 540, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2rem", letterSpacing: "0.06em" }}>🔍 CHECK GAME</div>
          <button className="btn-outline" onClick={() => setScreen("landing")} style={{ padding: "0.6rem 1.1rem", fontSize: "0.85rem" }}>← Back</button>
        </div>

        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontWeight: 700, marginBottom: "0.75rem" }}>Enter Room Code</div>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <input type="text" placeholder="e.g. AB3K7X" value={lookupCode}
              onChange={(e) => setLookupCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && lookupGame()}
              style={{ flex: 1, margin: 0 }} />
            <button className="btn-primary" onClick={lookupGame} disabled={lookupLoading || !lookupCode.trim()}
              style={{ whiteSpace: "nowrap", padding: "0.9rem 1.2rem" }}>
              {lookupLoading ? "..." : "Look Up"}
            </button>
          </div>
          {lookupError && <div style={{ color: C.primary, fontSize: "0.85rem", marginTop: "0.75rem" }}>{lookupError}</div>}
        </div>

        {lookupRoom && (() => {
          const statusMap: Record<string, string> = {
            lobby: "⏳ In Lobby",
            round_1: "🔥 Round 1 — Taking Submissions",
            round_2: "🗳️ Round 2 — Voting",
            completed: "✅ Completed",
          };
          const isParticipant = lookupRoom.players.some((p) => p.address === playerAddress);
          return (
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.5rem", letterSpacing: "0.06em" }}>ROOM {lookupRoom.room_code}</div>
                <div style={{ padding: "0.4rem 0.85rem", borderRadius: 8, background: `${C.secondary}15`, border: `1px solid ${C.secondary}30`, fontSize: "0.82rem", fontWeight: 600 }}>
                  {statusMap[lookupRoom.status] || lookupRoom.status}
                </div>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontSize: "0.78rem", color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.5rem" }}>Players</div>
                {lookupRoom.players.map((p) => (
                  <div key={p.address} style={{ display: "flex", gap: "0.6rem", alignItems: "center", padding: "0.4rem 0", borderBottom: `1px solid ${C.border}` }}>
                    <span>{p.address.startsWith("bot_") ? "🤖" : "👤"}</span>
                    <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{p.name}</span>
                    {p.address === playerAddress && <span style={{ fontSize: "0.75rem", color: C.muted }}>(you)</span>}
                    {p.address === lookupRoom.host && <span style={{ fontSize: "0.75rem", color: C.fire }}>👑</span>}
                  </div>
                ))}
              </div>

              {lookupRoom.status === "completed" && lookupRoom.results?.final_scores && (
                <div style={{ marginBottom: "1rem" }}>
                  <div style={{ fontSize: "0.78rem", color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.5rem" }}>Scores</div>
                  {Object.entries(lookupRoom.results.final_scores)
                    .sort(([, a]: any, [, b]: any) => b.total - a.total)
                    .map(([addr, d]: any, i) => (
                      <div key={addr} style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: `1px solid ${C.border}` }}>
                        <span style={{ fontSize: "0.88rem" }}>{["🥇","🥈","🥉"][i] || `${i+1}.`} {d.player_name}</span>
                        <span style={{ fontWeight: 700, color: i === 0 ? C.gold : C.text }}>{d.total}pts</span>
                      </div>
                    ))}
                </div>
              )}

              {isParticipant && lookupRoom.status !== "completed" && (
                <button className="btn-primary" onClick={() => rejoinFromLookup(lookupRoom)} style={{ width: "100%", marginTop: "0.5rem" }}>
                  ↩️ Rejoin This Game
                </button>
              )}
              {lookupRoom.status === "completed" && (
                <button className="btn-outline" onClick={() => rejoinFromLookup(lookupRoom)} style={{ width: "100%", marginTop: "0.5rem" }}>
                  📋 View Full Results
                </button>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );

  const renderStats = () => {
    const [myStats, setMyStats] = useState<any>(null);
    const [sl, setSl] = useState(true);
    useEffect(() => {
      readContract("get_player_stats", [playerAddress])
        .then((r: any) => { if (r) setMyStats(JSON.parse(r as string)); })
        .catch(() => {})
        .finally(() => setSl(false));
    }, [playerAddress]);

    return (
      <div style={{ minHeight: "100vh", background: C.bg, padding: "2rem 1.5rem" }} className="fadeIn">
        <div style={{ maxWidth: 580, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2rem", letterSpacing: "0.06em" }}>MY STATS</div>
            <button className="btn-outline" style={{ padding: "0.6rem 1.1rem", fontSize: "0.85rem" }} onClick={goHome}>← Back</button>
          </div>
          {sl
            ? <div className="card" style={{ textAlign: "center", padding: "3rem", color: C.muted }}><div className="spin" style={{ fontSize: "2rem" }}>🔥</div><div style={{ marginTop: "1rem" }}>Loading...</div></div>
            : myStats
              ? <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                    {[
                      { label: "Games Played", value: myStats.games_played, icon: "🎮" },
                      { label: "Wins", value: myStats.wins, icon: "🏆" },
                      { label: "Total Points", value: myStats.total_points, icon: "🔥" },
                      { label: "Win Rate", value: myStats.games_played > 0 ? `${Math.round(myStats.wins/myStats.games_played*100)}%` : "—", icon: "📊" },
                    ].map((s) => (
                      <div key={s.label} className="card" style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{s.icon}</div>
                        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2.5rem", color: C.primary }}>{s.value}</div>
                        <div style={{ color: C.muted, fontSize: "0.85rem" }}>{s.label}</div>
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
              : <div className="card" style={{ textAlign: "center", color: C.muted, padding: "3rem" }}><div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🎮</div>No games played yet. Get in there!</div>
          }
        </div>
      </div>
    );
  };

  const renderLeaderboard = () => (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "2rem 1.5rem" }} className="fadeIn">
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2rem", letterSpacing: "0.06em" }}>🏆 LEADERBOARD</div>
          <div style={{ display: "flex", gap: "0.65rem" }}>
            <button className="btn-outline" style={{ padding: "0.6rem 1.1rem", fontSize: "0.85rem" }} onClick={loadLeaderboard}>↻ Refresh</button>
            <button className="btn-outline" style={{ padding: "0.6rem 1.1rem", fontSize: "0.85rem" }} onClick={goHome}>← Back</button>
          </div>
        </div>
        {leaderboard.length === 0
          ? <div className="card" style={{ textAlign: "center", color: C.muted, padding: "3rem" }}><div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🏆</div>No players yet.</div>
          : <div className="card">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                {leaderboard.map((e, i) => {
                  const isMe = e.address === playerAddress;
                  return (
                    <div key={e.address} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "1rem 1.1rem", borderRadius: 10,
                      background: isMe ? `${C.primary}10` : i === 0 ? `${C.gold}08` : C.bg,
                      border: `1.5px solid ${isMe ? C.primary + "40" : i === 0 ? C.gold + "30" : C.border}`,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                        <div style={{ fontSize: "1.3rem", minWidth: 28 }}>{["🥇","🥈","🥉"][i] || `${i+1}.`}</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{e.address.slice(0,10)}...{isMe && <span style={{ color: C.muted, fontSize: "0.78rem" }}> (you)</span>}</div>
                          <div style={{ color: C.muted, fontSize: "0.78rem" }}>{e.games_played} games · {e.wins} wins</div>
                        </div>
                      </div>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.6rem", color: i === 0 ? C.gold : C.text }}>
                        {e.total_points} <span style={{ fontSize: "0.65rem", color: C.muted }}>pts</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
        }
      </div>
    </div>
  );

  const renderScreen = () => {
    switch (screen) {
      case "landing": return renderLanding();
      case "lobby": return renderLobby();
      case "game": return renderGame();
      case "results": return renderResults();
      case "stats": return renderStats();
      case "leaderboard": return renderLeaderboard();
      case "lookup": return renderLookup();
      default: return renderLanding();
    }
  };

  return (
    <>
      <style>{css}</style>
      {renderLoadingOverlay()}
      {renderWaitingForResults()}
      {renderScreen()}
    </>
  );
}

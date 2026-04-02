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
  votes: Record<string, string>;
  results: any;
  current_round: number;
  solo_mode?: boolean;
}

// ============================================
// CONTRACT HELPERS — no private key, no signing, no address needed
// Uses studionet pattern from POH working page
// ============================================
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
const MAX_ATTEMPTS = 3;

// Single session account — persisted for the lifetime of the page
let sessionAccount: ReturnType<typeof createAccount> | null = null;

function getSessionAccount() {
  if (!sessionAccount) {
    sessionAccount = createAccount();
  }
  return sessionAccount;
}

function makeClient() {
  const account = getSessionAccount();
  const client = createClient({ chain: studionet, account });
  return { client, account };
}

async function readContract(functionName: string, args: any[]): Promise<any> {
  const { client } = makeClient();
  return await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
  });
}

// Standard write — no return value needed
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
        retries: 100,
        interval: 4000,
      });
      return true;
    } catch (err: any) {
      console.error(`writeContract ${functionName} attempt ${attempt} failed:`, err?.message);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, attempt * 4000));
        continue;
      }
      throw err;
    }
  }
  return false;
}

// Write that captures a return value — uses simulate first, then executes
// Required for: create_room, create_solo_room (return room code string)
async function writeContractWithReturn(functionName: string, args: any[]): Promise<string> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { client } = makeClient();
      console.log(`writeContractWithReturn attempt ${attempt}/${MAX_ATTEMPTS}: ${functionName}`);
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
        retries: 100,
        interval: 4000,
      });
      return returnValue as string;
    } catch (err: any) {
      console.error(`writeContractWithReturn ${functionName} attempt ${attempt} failed:`, err?.message);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, attempt * 4000));
        continue;
      }
      throw err;
    }
  }
  throw new Error("All attempts failed");
}

// ============================================
// NEON PLAYGROUND COLORS
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
    background: ${C.surface}; 
    color: ${C.text}; 
    border: 2px solid ${C.border}; 
    border-radius: 12px; 
    padding: 0.9rem 1.1rem; 
    font-family: 'Space Grotesk', sans-serif; 
    font-size: 1rem; 
    outline: none; 
    transition: all 0.2s; 
    width: 100%; 
  }
  input:focus, textarea:focus { border-color: ${C.primary}; box-shadow: 0 0 0 3px ${C.primary}20; }
  textarea { resize: vertical; min-height: 100px; }

  .card { 
    background: ${C.card}; 
    border: 1.5px solid ${C.border}; 
    border-radius: 16px; 
    padding: 1.75rem; 
    box-shadow: ${C.shadow}; 
    transition: all 0.3s ease;
  }
  .card:hover { box-shadow: ${C.shadowHover}; }

  .btn-primary { 
    background: linear-gradient(135deg, ${C.primary}, ${C.fire}); 
    color: white; 
    border: none; 
    border-radius: 12px; 
    padding: 0.95rem 1.75rem; 
    font-weight: 700; 
    font-size: 1rem; 
    cursor: pointer; 
    transition: all 0.2s; 
    box-shadow: ${C.shadow};
    font-family: 'Space Grotesk', sans-serif;
  }
  .btn-primary:hover:not(:disabled) { 
    transform: translateY(-2px); 
    box-shadow: ${C.shadowHover}; 
  }
  .btn-primary:active:not(:disabled) { transform: translateY(0); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-outline { 
    background: transparent; 
    color: ${C.text}; 
    border: 2px solid ${C.border}; 
    border-radius: 12px; 
    padding: 0.9rem 1.5rem; 
    font-weight: 600; 
    font-size: 1rem; 
    cursor: pointer; 
    transition: all 0.2s;
    font-family: 'Space Grotesk', sans-serif;
  }
  .btn-outline:hover:not(:disabled) { 
    border-color: ${C.primary}; 
    color: ${C.primary}; 
    background: ${C.primary}08; 
  }
  .btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-secondary {
    background: ${C.secondary};
    color: #1A202C;
    border: none;
    border-radius: 12px;
    padding: 0.95rem 1.75rem;
    font-weight: 700;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: ${C.shadow};
    font-family: 'Space Grotesk', sans-serif;
  }
  .btn-secondary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: ${C.shadowHover};
  }
  .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

  .stance-genius { background: linear-gradient(135deg, ${C.gold}, ${C.fire}); color: #1A202C; }
  .stance-trash { background: #CBD5E0; color: #1A202C; }
  .stance-spicy { background: linear-gradient(135deg, ${C.purple}, ${C.primary}); color: white; }

  .fadeIn { animation: fadeIn 0.4s ease-in; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

  .pulse { animation: pulse 2s infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }

  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .slide-up { animation: slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
  @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: ${C.primary}12;
    border: 1px solid ${C.primary}30;
    border-radius: 100px;
    padding: 6px 16px;
    font-size: 0.78rem;
    font-weight: 600;
    color: ${C.primary};
    letter-spacing: 0.04em;
    text-transform: uppercase;
    margin-bottom: 1.5rem;
  }
  .hero-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(3.5rem, 10vw, 6rem);
    line-height: 0.92;
    letter-spacing: -0.01em;
    color: ${C.text};
    margin-bottom: 1.5rem;
  }
  .hero-title .highlight {
    background: linear-gradient(135deg, ${C.primary}, ${C.purple});
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .hero-subtitle {
    font-size: 1.1rem;
    color: ${C.muted};
    margin-bottom: 2.5rem;
    line-height: 1.7;
    font-weight: 400;
  }
  .stat-chip {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    padding: 0.75rem 1.25rem;
    background: ${C.surface};
    border: 1.5px solid ${C.border};
    border-radius: 12px;
    gap: 2px;
    min-width: 80px;
  }
  .stat-chip .num { font-family: 'Bebas Neue', sans-serif; font-size: 1.6rem; color: ${C.primary}; line-height: 1; }
  .stat-chip .lbl { font-size: 0.7rem; color: ${C.muted}; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
  .name-input-row {
    display: flex;
    gap: 0.75rem;
    align-items: stretch;
    margin-bottom: 0.75rem;
  }
  .name-input-row input { margin: 0; flex: 1; }
  .set-btn {
    background: ${C.text};
    color: white;
    border: none;
    border-radius: 12px;
    padding: 0 1.25rem;
    font-weight: 700;
    font-size: 0.9rem;
    cursor: pointer;
    white-space: nowrap;
    font-family: 'Space Grotesk', sans-serif;
    transition: background 0.2s;
  }
  .set-btn:hover { background: #2D3748; }
  .divider-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    color: ${C.muted};
    font-size: 0.85rem;
    margin: 0.25rem 0;
  }
  .divider-row::before, .divider-row::after {
    content: '';
    flex: 1;
    height: 1px;
    background: ${C.border};
  }
  .action-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    margin-top: 0.75rem;
  }
`;

export default function HotTakeProtocol() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [nameLocked, setNameLocked] = useState(false);

  const [playerName, setPlayerName] = useState("");
  const [playerAddress, setPlayerAddress] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  const [selectedScenario, setSelectedScenario] = useState<number | null>(null);
  const [selectedStance, setSelectedStance] = useState<string>("");
  const [takeText, setTakeText] = useState("");
  const [votes, setVotes] = useState<Record<string, string>>({});

  // ─────────────────────────────────────────────────────────
  // KEY FIX: Use a ref to track screen so the polling callback
  // always reads the CURRENT screen — not a stale closure value.
  // Without this, every client on the site jumps screens whenever
  // ANY room transitions, because all polling callbacks share a
  // stale copy of `screen` from when the interval was created.
  // ─────────────────────────────────────────────────────────
  const screenRef = useRef<Screen>("landing");
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollRoomCodeRef = useRef<string>("");

  // Keep screenRef in sync with screen state
  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  // Get account on mount (never changes within a session)
  useEffect(() => {
    const { account } = makeClient();
    setPlayerAddress(account.address);
    loadLeaderboard();
  }, []);

  // Restore name from localStorage (name only, never private key)
  useEffect(() => {
    const storedName = localStorage.getItem("htp_player_name");
    if (storedName) {
      setPlayerName(storedName);
      setNameLocked(true);
    }
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
      if (raw) {
        const data = JSON.parse(raw as string);
        setLeaderboard(data);
      }
    } catch (err) {
      console.error("Failed to load leaderboard:", err);
    }
  };

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    pollRoomCodeRef.current = "";
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
  }, [stopPolling]);

  // ─────────────────────────────────────────────────────────
  // KEY FIX: startPolling no longer depends on `screen` from
  // closure. It reads screenRef.current (always fresh) and
  // checks pollRoomCodeRef to ensure we only react to updates
  // for OUR room — not any other room's state changes.
  // ─────────────────────────────────────────────────────────
  const startPolling = useCallback((code: string) => {
    stopPolling();
    pollRoomCodeRef.current = code;

    const interval = setInterval(async () => {
      // Safety: don't poll if we left this room
      if (pollRoomCodeRef.current !== code) return;

      try {
        const raw = await readContract("get_room", [code]);
        if (!raw) return;
        const room = JSON.parse(raw as string) as Room;

        // Only update state if we're still on a screen related to this room
        const currentScreen = screenRef.current;
        if (currentScreen !== "lobby" && currentScreen !== "game" && currentScreen !== "results") return;

        setCurrentRoom(room);

        if (room.status === "round_1" && currentScreen === "lobby") {
          setScreen("game");
        } else if (room.status === "round_2" && currentScreen === "game") {
          // Stay on game screen — just update room state (voting phase shows automatically)
          setScreen("game");
        } else if (room.status === "completed" && currentScreen !== "results") {
          stopPolling();
          setScreen("results");
        }
      } catch (err) {
        console.error("Poll error:", err);
      }
    }, 3000);

    pollIntervalRef.current = interval;
  }, [stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // ─────────────────────────────────────────────────────────
  // ROOM ACTIONS
  // ─────────────────────────────────────────────────────────

  const createRoom = async () => {
    if (!playerName.trim()) {
      alert("Please enter your name first!");
      return;
    }
    setLoading(true);
    setLoadingMessage("Creating room...");
    try {
      localStorage.setItem("htp_player_name", playerName.trim());
      const code = await writeContractWithReturn("create_room", [playerAddress, playerName.trim()]);
      setRoomCode(code);
      const raw = await readContract("get_room", [code]);
      if (raw) {
        const room = JSON.parse(raw as string);
        setCurrentRoom(room);
        setScreen("lobby");
        startPolling(code);
      }
    } catch (err: any) {
      alert(`Failed to create room: ${err.message}`);
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const createSoloRoom = async () => {
    if (!playerName.trim()) {
      alert("Please enter your name first!");
      return;
    }
    setLoading(true);
    setLoadingMessage("Creating Solo Arena...");
    try {
      localStorage.setItem("htp_player_name", playerName.trim());
      const code = await writeContractWithReturn("create_solo_room", [playerAddress, playerName.trim()]);
      setRoomCode(code);
      const raw = await readContract("get_room", [code]);
      if (raw) {
        const room = JSON.parse(raw as string);
        setCurrentRoom(room);
        setScreen("lobby");
        startPolling(code);
      }
    } catch (err: any) {
      alert(`Failed to create solo room: ${err.message}`);
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const joinRoom = async () => {
    if (!playerName.trim() || !roomCode.trim()) {
      alert("Please enter your name and room code!");
      return;
    }
    setLoading(true);
    setLoadingMessage("Joining room...");
    try {
      localStorage.setItem("htp_player_name", playerName.trim());
      await writeContract("join_room", [roomCode.trim(), playerAddress, playerName.trim()]);
      const raw = await readContract("get_room", [roomCode.trim()]);
      if (raw) {
        const room = JSON.parse(raw as string);
        setCurrentRoom(room);
        setScreen("lobby");
        startPolling(roomCode.trim());
      }
    } catch (err: any) {
      alert(`Failed to join room: ${err.message}`);
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const toggleReady = async () => {
    if (!currentRoom) return;
    setLoading(true);
    try {
      await writeContract("toggle_ready", [currentRoom.room_code, playerAddress]);
      const raw = await readContract("get_room", [currentRoom.room_code]);
      if (raw) setCurrentRoom(JSON.parse(raw as string));
    } catch (err: any) {
      alert(`Failed to toggle ready: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // KEY FIX: startGame uses writeContract (not writeContractWithReturn)
  // but with a longer loading message since start_game calls AI
  // to generate scenarios (and bot takes in solo mode) — this
  // takes ~60s. We just wait it out with the spinner showing.
  // After it completes we read the room and navigate to game screen
  // directly rather than waiting for the poll to do it — that way
  // this player transitions immediately, but OTHER players (who are
  // also polling) will transition via their own poll when they see
  // room.status === "round_1". No global screen jumping.
  // ─────────────────────────────────────────────────────────
  const startGame = async () => {
    if (!currentRoom) return;
    setLoading(true);
    setLoadingMessage("Starting game — AI is generating scenarios...");
    try {
      await writeContract("start_game", [currentRoom.room_code, playerAddress]);
      const raw = await readContract("get_room", [currentRoom.room_code]);
      if (raw) {
        const room = JSON.parse(raw as string);
        setCurrentRoom(room);
        if (room.status === "round_1") {
          setScreen("game");
        }
      }
    } catch (err: any) {
      alert(`Failed to start game: ${err.message}`);
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const submitTake = async () => {
    if (!currentRoom || selectedScenario === null || !selectedStance || !takeText.trim()) {
      alert("Please select a scenario, stance, and write your take!");
      return;
    }
    setLoading(true);
    setLoadingMessage("Submitting your hot take...");
    try {
      await writeContract("submit_take", [
        currentRoom.room_code,
        playerAddress,
        selectedScenario,
        selectedStance,
        takeText.trim(),
      ]);
      const raw = await readContract("get_room", [currentRoom.room_code]);
      if (raw) {
        const room = JSON.parse(raw as string) as Room;
        setCurrentRoom(room);

        // Check if all human players (and bots already submitted at start_game)
        // have submitted — if so, advance to voting
        const allSubmitted = room.players.every((p: Player) =>
          Object.keys(room.submissions).some((key) => key.startsWith(p.address))
        );
        if (allSubmitted) {
          setLoadingMessage("All takes in — moving to voting...");
          await writeContract("advance_to_voting", [currentRoom.room_code]);
          const updatedRaw = await readContract("get_room", [currentRoom.room_code]);
          if (updatedRaw) setCurrentRoom(JSON.parse(updatedRaw as string));
        }
      }
    } catch (err: any) {
      alert(`Failed to submit take: ${err.message}`);
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const submitVotes = async () => {
    if (!currentRoom) return;
    setLoading(true);
    setLoadingMessage("Submitting votes...");
    try {
      const votesArray = Object.values(votes);
      await writeContract("submit_votes", [
        currentRoom.room_code,
        playerAddress,
        JSON.stringify(votesArray),
      ]);
      const raw = await readContract("get_room", [currentRoom.room_code]);
      if (raw) {
        const room = JSON.parse(raw as string) as Room;
        setCurrentRoom(room);

        // Check if all human players have voted (bots auto-vote in contract)
        const allVoted = room.players.every(
          (p: Player) => p.address.startsWith("bot_") || room.votes[p.address]
        );
        if (allVoted) {
          setLoadingMessage("Calculating results with AI judges...");
          await writeContract("calculate_results", [currentRoom.room_code]);
          const resultsRaw = await readContract("get_room", [currentRoom.room_code]);
          if (resultsRaw) {
            const resultsRoom = JSON.parse(resultsRaw as string);
            setCurrentRoom(resultsRoom);
            stopPolling();
            setScreen("results");
          }
        }
      }
    } catch (err: any) {
      alert(`Failed to submit votes: ${err.message}`);
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const copyRoomCode = () => {
    if (currentRoom) {
      navigator.clipboard.writeText(currentRoom.room_code);
      alert("Room code copied!");
    }
  };

  // ─────────────────────────────────────────────────────────
  // RENDER FUNCTIONS
  // ─────────────────────────────────────────────────────────

  const renderLoadingOverlay = () => {
    if (!loading) return null;
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          backdropFilter: "blur(4px)",
        }}
      >
        <div className="card" style={{ textAlign: "center", minWidth: 300 }}>
          <div className="spin" style={{ fontSize: "3rem", marginBottom: "1rem" }}>
            🔥
          </div>
          <div style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: "0.5rem" }}>
            {loadingMessage || "Loading..."}
          </div>
          <div style={{ color: C.muted, fontSize: "0.9rem" }}>Please wait...</div>
        </div>
      </div>
    );
  };

  const renderLanding = () => (
    <div style={{ minHeight: "100vh", background: C.bg }} className="fadeIn">
      <div
        style={{
          background: "linear-gradient(160deg, #fff 0%, #FFF5F2 60%, #F5F7FA 100%)",
          borderBottom: `1px solid ${C.border}`,
          padding: "4rem 1.5rem 3rem",
        }}
      >
        <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
          <div className="hero-badge">
            <span>🔥</span> Powered by GenLayer AI
          </div>
          {/* Updated hero copy — replaced "WIN THE CROWD" */}
          <h1 className="hero-title">
            DROP YOUR
            <br />
            <span className="highlight">HOT TAKES</span>
            <br />
            OWN THE ROOM
          </h1>
          <p className="hero-subtitle">
            A 5-player debate game where AI judges your arguments.
            <br />
            The spiciest take wins.
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "0.75rem",
              marginBottom: "3rem",
              flexWrap: "wrap",
            }}
          >
            <div className="stat-chip">
              <span className="num">5</span>
              <span className="lbl">Players</span>
            </div>
            <div className="stat-chip">
              <span className="num">3</span>
              <span className="lbl">Rounds</span>
            </div>
            <div className="stat-chip">
              <span className="num">AI</span>
              <span className="lbl">Judges</span>
            </div>
            <div className="stat-chip">
              {/* "10m" = 10-minute game — label updated to be clearer */}
              <span className="num">10m</span>
              <span className="lbl">Per Game</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: "0.8rem",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: C.muted,
              marginBottom: "0.85rem",
            }}
          >
            Your Player Name
          </div>
          <div className="name-input-row">
            <input
              type="text"
              placeholder="Enter your name..."
              value={playerName}
              onChange={(e) => {
                setPlayerName(e.target.value);
                setNameLocked(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && lockName()}
              disabled={nameLocked}
            />
            {nameLocked ? (
              <button
                className="set-btn"
                style={{ background: C.secondary, color: C.text }}
                onClick={() => setNameLocked(false)}
              >
                ✏️ Edit
              </button>
            ) : (
              <button className="set-btn" onClick={lockName}>
                Set →
              </button>
            )}
          </div>
          {nameLocked && (
            <div
              style={{ fontSize: "0.8rem", color: C.secondary, fontWeight: 600, marginTop: "0.4rem" }}
            >
              ✓ Ready as <strong>{playerName}</strong>
            </div>
          )}
        </div>

        <button
          className="btn-primary"
          onClick={createRoom}
          disabled={loading || !playerName.trim()}
          style={{ width: "100%", marginBottom: "0.75rem", padding: "1.1rem", fontSize: "1rem" }}
        >
          🔥 CREATE ROOM
        </button>

        <div style={{ display: "flex", gap: "0.6rem", marginBottom: "0.75rem" }}>
          <input
            type="text"
            placeholder="Room code..."
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && joinRoom()}
            style={{ flex: 1, margin: 0 }}
          />
          <button
            className="btn-outline"
            onClick={joinRoom}
            disabled={loading || !playerName.trim() || !roomCode.trim()}
            style={{ whiteSpace: "nowrap", padding: "0.9rem 1.2rem" }}
          >
            JOIN
          </button>
        </div>

        <div className="divider-row">or play solo</div>

        <button
          className="btn-secondary"
          onClick={createSoloRoom}
          disabled={loading || !playerName.trim()}
          style={{ width: "100%", marginBottom: "1.75rem", padding: "1rem" }}
        >
          🤖 SOLO ARENA — Play vs AI Bots
        </button>

        <div className="action-grid">
          <button
            className="btn-outline"
            onClick={() => setScreen("stats")}
            style={{ textAlign: "center", padding: "0.85rem" }}
          >
            📊 My Stats
          </button>
          <button
            className="btn-outline"
            onClick={() => setScreen("leaderboard")}
            style={{ textAlign: "center", padding: "0.85rem" }}
          >
            🏆 Leaderboard
          </button>
        </div>

        <div
          style={{ marginTop: "1.5rem", textAlign: "center", color: C.muted, fontSize: "0.78rem" }}
        >
          Your ID:{" "}
          <code style={{ color: C.text }}>
            {playerAddress ? playerAddress.slice(0, 14) + "..." : "—"}
          </code>
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
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "2rem",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: "2rem",
                  letterSpacing: "0.06em",
                }}
              >
                {isSolo ? "SOLO ARENA" : "LOBBY"}
              </div>
              <div style={{ color: C.muted, fontSize: "0.9rem" }}>
                Room: <strong>{currentRoom.room_code}</strong>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.65rem" }}>
              <button
                className="btn-outline"
                onClick={copyRoomCode}
                style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
              >
                📋 Copy
              </button>
              <button
                className="btn-outline"
                onClick={goHome}
                style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
              >
                ← Leave
              </button>
            </div>
          </div>

          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontWeight: 700, marginBottom: "1.25rem", fontSize: "1rem" }}>
              Players ({currentRoom.players.length}/5)
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {currentRoom.players.map((p) => (
                <div
                  key={p.address}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.9rem 1rem",
                    borderRadius: 10,
                    background: p.address === playerAddress ? `${C.primary}10` : C.bg,
                    border: `1.5px solid ${p.address === playerAddress ? C.primary + "40" : C.border}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div style={{ fontSize: "1.5rem" }}>
                      {p.address.startsWith("bot_") ? "🤖" : "👤"}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                        {p.name}
                        {p.address === currentRoom.host && (
                          <span style={{ color: C.fire, marginLeft: "0.5rem", fontSize: "0.8rem" }}>
                            👑 HOST
                          </span>
                        )}
                      </div>
                      <div style={{ color: C.muted, fontSize: "0.78rem" }}>
                        {p.address.startsWith("bot_") ? "AI Bot" : p.address.slice(0, 12) + "..."}
                      </div>
                    </div>
                  </div>
                  <div>
                    {p.ready ? (
                      <div style={{ color: C.secondary, fontWeight: 700, fontSize: "0.85rem" }}>
                        ✓ READY
                      </div>
                    ) : (
                      <div style={{ color: C.muted, fontSize: "0.85rem" }}>Waiting...</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {!isSolo && (
            <div
              className="card"
              style={{
                background: `${C.fire}10`,
                borderColor: `${C.fire}40`,
                marginBottom: "1.5rem",
              }}
            >
              <div style={{ fontSize: "0.9rem", color: C.text }}>
                <strong>Share this code:</strong>{" "}
                <span style={{ color: C.fire, fontWeight: 700, fontSize: "1.1rem" }}>
                  {currentRoom.room_code}
                </span>
                <div style={{ color: C.muted, fontSize: "0.85rem", marginTop: "0.25rem" }}>
                  Friends can join from the homepage
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "0.75rem" }}>
            {isHost ? (
              <button
                className="btn-primary"
                onClick={startGame}
                disabled={!canStart || loading}
                style={{ flex: 1 }}
              >
                {canStart ? "🚀 Start Game" : `Need ${isSolo ? 1 : 3}+ players`}
              </button>
            ) : (
              <button
                className="btn-outline"
                onClick={toggleReady}
                disabled={loading || isSolo}
                style={{ flex: 1 }}
              >
                {myPlayer?.ready ? "❌ Not Ready" : "✓ Ready Up"}
              </button>
            )}
          </div>

          {isSolo && (
            <div
              className="card"
              style={{
                marginTop: "1.5rem",
                background: `${C.secondary}10`,
                borderColor: `${C.secondary}40`,
              }}
            >
              <div style={{ fontSize: "0.9rem", color: C.text }}>
                <strong>🤖 AI Bot Lineup:</strong>
                <div
                  style={{
                    marginTop: "0.75rem",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.5rem",
                  }}
                >
                  {["AgreeBot", "DevilBot", "JokerBot", "ThinkBot"].map((bot) => (
                    <div key={bot} style={{ fontSize: "0.85rem", color: C.muted }}>
                      • {bot}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderGame = () => {
    if (!currentRoom) return null;
    const mySubmission = Object.entries(currentRoom.submissions).find(([key]) =>
      key.startsWith(playerAddress)
    );
    const hasSubmitted = !!mySubmission;
    const isRound1 = currentRoom.status === "round_1";
    const isRound2 = currentRoom.status === "round_2";

    return (
      <div style={{ minHeight: "100vh", background: C.bg, padding: "2rem 1.5rem" }} className="fadeIn">
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "2rem",
            }}
          >
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: "2rem",
                letterSpacing: "0.06em",
              }}
            >
              {isRound1 ? "ROUND 1: HOT TAKES" : "ROUND 2: VOTING"}
            </div>
            <div style={{ color: C.muted, fontSize: "0.85rem" }}>Room: {currentRoom.room_code}</div>
          </div>

          {isRound1 && (
            <>
              {!hasSubmitted ? (
                <>
                  <div className="card" style={{ marginBottom: "1.5rem" }}>
                    <div style={{ fontWeight: 700, marginBottom: "1.25rem", fontSize: "1rem" }}>
                      Choose Your Scenario
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                      {currentRoom.scenarios.map((s, i) => (
                        <div
                          key={i}
                          onClick={() => setSelectedScenario(i)}
                          style={{
                            padding: "1rem 1.25rem",
                            borderRadius: 12,
                            border: `2px solid ${selectedScenario === i ? C.primary : C.border}`,
                            background: selectedScenario === i ? `${C.primary}08` : C.surface,
                            cursor: "pointer",
                            transition: "all 0.2s",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 700,
                              marginBottom: "0.3rem",
                              color: selectedScenario === i ? C.primary : C.text,
                            }}
                          >
                            {s.title}
                          </div>
                          <div style={{ fontSize: "0.85rem", color: C.muted }}>{s.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedScenario !== null && (
                    <div className="card slide-up" style={{ marginBottom: "1.5rem" }}>
                      <div style={{ fontWeight: 700, marginBottom: "1rem", fontSize: "1rem" }}>
                        Your Stance
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr 1fr",
                          gap: "0.75rem",
                          marginBottom: "1.25rem",
                        }}
                      >
                        {[
                          { value: "genius", label: "🔥 Genius", cls: "stance-genius" },
                          { value: "trash", label: "🗑️ Trash", cls: "stance-trash" },
                          { value: "spicy", label: "😈 Spicy", cls: "stance-spicy" },
                        ].map(({ value, label, cls }) => (
                          <div
                            key={value}
                            onClick={() => setSelectedStance(value)}
                            className={cls}
                            style={{
                              padding: "0.85rem",
                              borderRadius: 10,
                              textAlign: "center",
                              fontWeight: 700,
                              fontSize: "0.9rem",
                              cursor: "pointer",
                              border: `2px solid ${selectedStance === value ? "#1A202C" : "transparent"}`,
                              opacity: selectedStance === value ? 1 : 0.7,
                              transition: "all 0.2s",
                            }}
                          >
                            {label}
                          </div>
                        ))}
                      </div>
                      <div style={{ fontWeight: 700, marginBottom: "0.75rem", fontSize: "1rem" }}>
                        Your Take (100 chars max)
                      </div>
                      <textarea
                        placeholder="Write your hot take..."
                        value={takeText}
                        onChange={(e) => setTakeText(e.target.value.slice(0, 100))}
                        style={{ marginBottom: "0.5rem" }}
                      />
                      <div
                        style={{
                          textAlign: "right",
                          color: C.muted,
                          fontSize: "0.85rem",
                          marginBottom: "1rem",
                        }}
                      >
                        {takeText.length}/100
                      </div>
                      <button
                        className="btn-primary"
                        onClick={submitTake}
                        disabled={!selectedStance || !takeText.trim() || loading}
                        style={{ width: "100%" }}
                      >
                        🔥 Submit Take
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
                  <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✓</div>
                  <div style={{ fontWeight: 700, fontSize: "1.25rem", marginBottom: "0.75rem" }}>
                    Take Submitted!
                  </div>
                  <div style={{ color: C.muted, marginBottom: "1.5rem" }}>
                    Waiting for other players...
                  </div>
                  <div className="pulse" style={{ color: C.fire, fontSize: "0.9rem" }}>
                    {
                      currentRoom.players.filter((p) =>
                        Object.keys(currentRoom.submissions).some((k) => k.startsWith(p.address))
                      ).length
                    }
                    /{currentRoom.players.length} submitted
                  </div>
                </div>
              )}
            </>
          )}

          {isRound2 && (
            <>
              <div className="card" style={{ marginBottom: "1.5rem" }}>
                <div style={{ fontWeight: 700, marginBottom: "1.25rem", fontSize: "1rem" }}>
                  Vote for the Best Takes (select up to 3)
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                  {currentRoom.players
                    .filter((p) => p.address !== playerAddress && !p.address.startsWith("bot_"))
                    .map((p) => {
                      const submission = Object.entries(currentRoom.submissions).find(([key]) =>
                        key.startsWith(p.address)
                      );
                      if (!submission) return null;
                      const [, data] = submission;
                      const scenario = currentRoom.scenarios[data.scenario_index];
                      const isVoted = Object.values(votes).includes(p.address);
                      return (
                        <div
                          key={p.address}
                          onClick={() => {
                            if (Object.keys(votes).length >= 3 && !isVoted) return;
                            const newVotes = { ...votes };
                            const existingKey = Object.keys(newVotes).find(
                              (k) => newVotes[k] === p.address
                            );
                            if (existingKey) delete newVotes[existingKey];
                            else newVotes[Date.now().toString()] = p.address;
                            setVotes(newVotes);
                          }}
                          style={{
                            padding: "1rem 1.25rem",
                            borderRadius: 12,
                            border: `2px solid ${isVoted ? C.primary : C.border}`,
                            background: isVoted ? `${C.primary}08` : C.surface,
                            cursor: "pointer",
                            transition: "all 0.2s",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              marginBottom: "0.5rem",
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{p.name}</div>
                              <div style={{ fontSize: "0.78rem", color: C.muted }}>
                                {scenario?.title}
                              </div>
                            </div>
                            <div
                              className={`stance-${data.stance}`}
                              style={{
                                padding: "0.4rem 0.75rem",
                                borderRadius: 8,
                                fontSize: "0.75rem",
                                fontWeight: 700,
                              }}
                            >
                              {data.stance === "genius"
                                ? "🔥"
                                : data.stance === "trash"
                                ? "🗑️"
                                : "😈"}
                            </div>
                          </div>
                          <div style={{ fontSize: "0.9rem", fontStyle: "italic", color: C.text }}>
                            &ldquo;{data.take}&rdquo;
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
              <div
                style={{
                  marginBottom: "1rem",
                  textAlign: "center",
                  color: C.muted,
                  fontSize: "0.85rem",
                }}
              >
                {Object.keys(votes).length}/3 votes cast
              </div>
              <button
                className="btn-primary"
                onClick={submitVotes}
                disabled={Object.keys(votes).length === 0 || loading}
                style={{ width: "100%" }}
              >
                Submit Votes ({Object.keys(votes).length})
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderResults = () => {
    if (!currentRoom || !currentRoom.results) return null;
    const { final_scores, ai_rankings } = currentRoom.results;
    const sortedScores = Object.entries(final_scores || {})
      .map(([addr, data]: [string, any]) => ({ address: addr, ...data }))
      .sort((a: any, b: any) => b.total - a.total);

    return (
      <div style={{ minHeight: "100vh", background: C.bg, padding: "2rem 1.5rem" }} className="fadeIn">
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>
              {sortedScores[0]?.address === playerAddress ? "🏆" : "🔥"}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: "3rem",
                letterSpacing: "0.06em",
              }}
            >
              {sortedScores[0]?.address === playerAddress ? "VICTORY!" : "GAME OVER"}
            </div>
          </div>

          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontWeight: 700, marginBottom: "1.25rem", fontSize: "1rem" }}>
              Final Scores
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {sortedScores.map((score: any, i: number) => {
                const medals = ["🥇", "🥈", "🥉"];
                return (
                  <div
                    key={score.address}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "1rem 1.25rem",
                      borderRadius: 12,
                      background:
                        score.address === playerAddress
                          ? `${C.primary}10`
                          : i === 0
                          ? `${C.gold}10`
                          : C.bg,
                      border: `2px solid ${
                        score.address === playerAddress
                          ? C.primary + "40"
                          : i === 0
                          ? C.gold + "40"
                          : C.border
                      }`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                      <div style={{ fontSize: "1.5rem", minWidth: 32 }}>
                        {medals[i] || `${i + 1}.`}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                          {score.player_name}
                          {score.address === playerAddress && (
                            <span style={{ color: C.muted, fontSize: "0.8rem" }}> (you)</span>
                          )}
                        </div>
                        <div style={{ fontSize: "0.78rem", color: C.muted }}>
                          AI: {score.ai_points}pts · Votes: +{score.vote_bonus}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        fontFamily: "'Bebas Neue', sans-serif",
                        fontSize: "1.75rem",
                        color: i === 0 ? C.gold : C.text,
                      }}
                    >
                      {score.total}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {ai_rankings && (
            <div className="card" style={{ marginBottom: "1.5rem" }}>
              <div style={{ fontWeight: 700, marginBottom: "1rem", fontSize: "1rem" }}>
                🤖 AI Judge Reasoning
              </div>
              {Object.entries(ai_rankings).map(([scenarioKey, rankings]: [string, any]) => {
                const scenarioIdx = parseInt(scenarioKey.replace("scenario_", ""));
                const scenario = currentRoom.scenarios[scenarioIdx];
                return (
                  <div key={scenarioKey} style={{ marginBottom: "1rem" }}>
                    <div
                      style={{
                        fontWeight: 700,
                        marginBottom: "0.5rem",
                        color: C.fire,
                        fontSize: "0.9rem",
                      }}
                    >
                      {scenario?.title || scenarioKey}
                    </div>
                    {Array.isArray(rankings) &&
                      rankings.map((rank: any) => {
                        const pName =
                          currentRoom.players.find((p) => p.address === rank.player)?.name ||
                          rank.player?.slice(0, 8) + "...";
                        return (
                          <div
                            key={rank.player}
                            style={{
                              display: "flex",
                              gap: "0.75rem",
                              padding: "0.75rem 0.85rem",
                              background: C.bg,
                              borderRadius: 8,
                              marginBottom: "0.5rem",
                            }}
                          >
                            <div
                              style={{
                                color: rank.rank === 1 ? C.gold : C.muted,
                                fontWeight: 700,
                                minWidth: 24,
                                fontSize: "0.9rem",
                              }}
                            >
                              #{rank.rank}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                                {pName} ·{" "}
                                <span style={{ color: C.muted, fontWeight: 400 }}>
                                  {rank.score}pts
                                </span>
                              </div>
                              <div style={{ color: C.muted, fontSize: "0.82rem", marginTop: "0.2rem" }}>
                                {rank.reasoning}
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
            <button className="btn-primary" style={{ flex: 1 }} onClick={createRoom} disabled={loading}>
              🔥 Play Again
            </button>
            <button className="btn-outline" onClick={goHome}>
              🏠 Home
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderStats = () => {
    const [myStats, setMyStats] = useState<any>(null);
    const [statsLoading, setStatsLoading] = useState(true);
    useEffect(() => {
      readContract("get_player_stats", [playerAddress])
        .then((raw: any) => {
          if (raw) setMyStats(JSON.parse(raw as string));
        })
        .catch(() => {})
        .finally(() => setStatsLoading(false));
    }, [playerAddress]);

    return (
      <div style={{ minHeight: "100vh", background: C.bg, padding: "2rem 1.5rem" }} className="fadeIn">
        <div style={{ maxWidth: 580, margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "2rem",
            }}
          >
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: "2rem",
                letterSpacing: "0.06em",
              }}
            >
              MY STATS
            </div>
            <button
              className="btn-outline"
              style={{ padding: "0.6rem 1.1rem", fontSize: "0.85rem" }}
              onClick={goHome}
            >
              ← Back
            </button>
          </div>
          {statsLoading ? (
            <div className="card" style={{ textAlign: "center", padding: "3rem", color: C.muted }}>
              <div className="spin" style={{ fontSize: "2.5rem" }}>🔥</div>
              <div style={{ marginTop: "1rem" }}>Loading stats...</div>
            </div>
          ) : myStats ? (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem",
                  marginBottom: "1.5rem",
                }}
              >
                {[
                  { label: "Games Played", value: myStats.games_played, icon: "🎮" },
                  { label: "Wins", value: myStats.wins, icon: "🏆" },
                  { label: "Total Points", value: myStats.total_points, icon: "🔥" },
                  {
                    label: "Win Rate",
                    value:
                      myStats.games_played > 0
                        ? `${Math.round((myStats.wins / myStats.games_played) * 100)}%`
                        : "—",
                    icon: "📊",
                  },
                ].map((stat) => (
                  <div key={stat.label} className="card" style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{stat.icon}</div>
                    <div
                      style={{
                        fontFamily: "'Bebas Neue', sans-serif",
                        fontSize: "2.5rem",
                        color: C.primary,
                      }}
                    >
                      {stat.value}
                    </div>
                    <div style={{ color: C.muted, fontSize: "0.85rem" }}>{stat.label}</div>
                  </div>
                ))}
              </div>
              {myStats.best_performance && (
                <div
                  className="card"
                  style={{ background: `${C.gold}10`, borderColor: `${C.gold}40` }}
                >
                  <div
                    style={{ color: C.gold, fontWeight: 700, marginBottom: "0.5rem", fontSize: "0.95rem" }}
                  >
                    🏅 Best Performance
                  </div>
                  <div style={{ color: C.muted, fontSize: "0.9rem" }}>
                    Score:{" "}
                    <strong style={{ color: C.text }}>{myStats.best_performance.score} pts</strong> in
                    Game #{myStats.best_performance.game_id}
                  </div>
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

  const renderLeaderboard = () => (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "2rem 1.5rem" }} className="fadeIn">
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "2rem",
          }}
        >
          <div
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: "2rem",
              letterSpacing: "0.06em",
            }}
          >
            🏆 LEADERBOARD
          </div>
          <div style={{ display: "flex", gap: "0.65rem" }}>
            <button
              className="btn-outline"
              style={{ padding: "0.6rem 1.1rem", fontSize: "0.85rem" }}
              onClick={loadLeaderboard}
            >
              ↻ Refresh
            </button>
            <button
              className="btn-outline"
              style={{ padding: "0.6rem 1.1rem", fontSize: "0.85rem" }}
              onClick={goHome}
            >
              ← Back
            </button>
          </div>
        </div>
        {leaderboard.length === 0 ? (
          <div className="card" style={{ textAlign: "center", color: C.muted, padding: "3rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🏆</div>
            No players on the leaderboard yet. Play some games!
          </div>
        ) : (
          <div className="card">
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              {leaderboard.map((entry, i) => {
                const medals = ["🥇", "🥈", "🥉"];
                const isMe = entry.address === playerAddress;
                return (
                  <div
                    key={entry.address}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "1rem 1.1rem",
                      borderRadius: 10,
                      background: isMe
                        ? `${C.primary}10`
                        : i === 0
                        ? `${C.gold}08`
                        : C.bg,
                      border: `1.5px solid ${
                        isMe ? C.primary + "40" : i === 0 ? C.gold + "30" : C.border
                      }`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                      <div style={{ fontSize: "1.3rem", minWidth: 28 }}>
                        {medals[i] || `${i + 1}.`}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                          {entry.address.slice(0, 10)}...
                          {isMe && (
                            <span style={{ color: C.muted, fontWeight: 400, fontSize: "0.78rem" }}>
                              {" "}
                              (you)
                            </span>
                          )}
                        </div>
                        <div style={{ color: C.muted, fontSize: "0.78rem" }}>
                          {entry.games_played} games · {entry.wins} wins
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        fontFamily: "'Bebas Neue', sans-serif",
                        fontSize: "1.6rem",
                        color: i === 0 ? C.gold : C.text,
                      }}
                    >
                      {entry.total_points}{" "}
                      <span style={{ fontSize: "0.65rem", color: C.muted }}>pts</span>
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
    switch (screen) {
      case "landing":
        return renderLanding();
      case "lobby":
        return renderLobby();
      case "game":
        return renderGame();
      case "results":
        return renderResults();
      case "stats":
        return renderStats();
      case "leaderboard":
        return renderLeaderboard();
      default:
        return renderLanding();
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

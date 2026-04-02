"use client";

import { useState, useEffect, useCallback } from "react";
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
// CONTRACT HELPERS
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

async function writeContractWithReturn(functionName: string, args: any[]): Promise<string> {
  if (!CONTRACT_ADDRESS) throw new Error("Contract address not configured");
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
        await new Promise((r) => setTimeout(r, attempt * 3000));
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
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;700;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${C.bg}; color: ${C.text}; font-family: 'DM Sans', sans-serif; line-height: 1.6; }
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
    font-family: 'DM Sans', sans-serif; 
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
    font-family: 'DM Sans', sans-serif;
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
    font-family: 'DM Sans', sans-serif;
  }
  .btn-outline:hover:not(:disabled) { 
    border-color: ${C.primary}; 
    color: ${C.primary}; 
    background: ${C.primary}08; 
  }
  .btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-secondary {
    background: ${C.secondary};
    color: white;
    border: none;
    border-radius: 12px;
    padding: 0.95rem 1.75rem;
    font-weight: 700;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: ${C.shadow};
    font-family: 'DM Sans', sans-serif;
  }
  .btn-secondary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: ${C.shadowHover};
  }

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
`;

export default function HotTakeProtocol() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [envError, setEnvError] = useState("");
  
  const [playerName, setPlayerName] = useState("");
  const [playerAddress, setPlayerAddress] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  
  const [selectedScenario, setSelectedScenario] = useState<number | null>(null);
  const [selectedStance, setSelectedStance] = useState<string>("");
  const [takeText, setTakeText] = useState("");
  const [votes, setVotes] = useState<Record<string, string>>({});
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!CONTRACT_ADDRESS) {
      setEnvError("Missing contract address. Set NEXT_PUBLIC_CONTRACT_ADDRESS in .env.local");
    }
    const stored = localStorage.getItem("htp_player_name");
    if (stored) setPlayerName(stored);
    const account = getOrCreateAccount();
    setPlayerAddress(account.address);
    loadLeaderboard();
  }, []);

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

  const goHome = () => {
    if (pollInterval) clearInterval(pollInterval);
    setPollInterval(null);
    setScreen("landing");
    setCurrentRoom(null);
    setRoomCode("");
    setSelectedScenario(null);
    setSelectedStance("");
    setTakeText("");
    setVotes({});
  };

  const startPolling = useCallback((code: string) => {
    if (pollInterval) clearInterval(pollInterval);
    const interval = setInterval(async () => {
      try {
        const raw = await readContract("get_room", [code]);
        if (raw) {
          const room = JSON.parse(raw as string);
          setCurrentRoom(room);
          if (room.status === "completed") {
            clearInterval(interval);
            setPollInterval(null);
            setScreen("results");
          } else if (room.status === "round_2" && screen === "game") {
            setScreen("game");
          }
        }
      } catch (err) {
        console.error("Poll error:", err);
      }
    }, 3000);
    setPollInterval(interval);
  }, [screen, pollInterval]);

  useEffect(() => {
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [pollInterval]);

  const createRoom = async () => {
    if (!playerName.trim()) {
      alert("Please enter your name first!");
      return;
    }
    setLoading(true);
    setLoadingMessage("Creating room...");
    try {
      localStorage.setItem("htp_player_name", playerName);
      const code = await writeContractWithReturn("create_room", [playerAddress, playerName]);
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
      localStorage.setItem("htp_player_name", playerName);
      const code = await writeContractWithReturn("create_solo_room", [playerAddress, playerName]);
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
      localStorage.setItem("htp_player_name", playerName);
      await writeContract("join_room", [roomCode, playerAddress, playerName]);
      const raw = await readContract("get_room", [roomCode]);
      if (raw) {
        const room = JSON.parse(raw as string);
        setCurrentRoom(room);
        setScreen("lobby");
        startPolling(roomCode);
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
      if (raw) {
        const room = JSON.parse(raw as string);
        setCurrentRoom(room);
      }
    } catch (err: any) {
      alert(`Failed to toggle ready: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const startGame = async () => {
    if (!currentRoom) return;
    setLoading(true);
    setLoadingMessage("Starting game and generating scenarios...");
    try {
      await writeContract("start_game", [currentRoom.room_code, playerAddress]);
      const raw = await readContract("get_room", [currentRoom.room_code]);
      if (raw) {
        const room = JSON.parse(raw as string);
        setCurrentRoom(room);
        setScreen("game");
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
      await writeContract("submit_take", [currentRoom.room_code, playerAddress, selectedScenario, selectedStance, takeText]);
      const raw = await readContract("get_room", [currentRoom.room_code]);
      if (raw) {
        const room = JSON.parse(raw as string);
        setCurrentRoom(room);
        
        const allSubmitted = room.players.every((p: Player) => 
          Object.keys(room.submissions).some(key => key.startsWith(p.address))
        );
        if (allSubmitted) {
          await writeContract("advance_to_voting", [currentRoom.room_code]);
          const updatedRaw = await readContract("get_room", [currentRoom.room_code]);
          if (updatedRaw) {
            const updatedRoom = JSON.parse(updatedRaw as string);
            setCurrentRoom(updatedRoom);
          }
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
      await writeContract("submit_votes", [currentRoom.room_code, playerAddress, JSON.stringify(votesArray)]);
      const raw = await readContract("get_room", [currentRoom.room_code]);
      if (raw) {
        const room = JSON.parse(raw as string);
        setCurrentRoom(room);
        
        const allVoted = room.players.every((p: Player) => 
          p.address.startsWith("bot_") || room.votes[p.address]
        );
        if (allVoted) {
          setLoadingMessage("Calculating results with AI judges...");
          await writeContract("calculate_results", [currentRoom.room_code]);
          const resultsRaw = await readContract("get_room", [currentRoom.room_code]);
          if (resultsRaw) {
            const resultsRoom = JSON.parse(resultsRaw as string);
            setCurrentRoom(resultsRoom);
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

  const renderLoadingOverlay = () => {
    if (!loading) return null;
    return (
      <div style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        backdropFilter: "blur(4px)",
      }}>
        <div className="card" style={{ textAlign: "center", minWidth: 300 }}>
          <div className="spin" style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔥</div>
          <div style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: "0.5rem" }}>{loadingMessage || "Loading..."}</div>
          <div style={{ color: C.muted, fontSize: "0.9rem" }}>Please wait...</div>
        </div>
      </div>
    );
  };

  const renderLanding = () => (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", padding: "2rem 1.5rem" }} className="fadeIn">
      <div style={{ maxWidth: 520, margin: "0 auto", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🔥</div>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "3.5rem", letterSpacing: "0.06em", lineHeight: 1.1, marginBottom: "1rem" }}>
            HOT TAKE<br />PROTOCOL
          </h1>
          <p style={{ color: C.muted, fontSize: "1.1rem", marginBottom: "0.75rem" }}>
            Debate. Argue. Win with AI.
          </p>
          <p style={{ color: C.muted, fontSize: "0.9rem" }}>
            5-player debate game powered by GenLayer
          </p>
        </div>

        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontWeight: 700, marginBottom: "1rem", fontSize: "0.9rem" }}>YOUR NAME</div>
          <input
            type="text"
            placeholder="Enter your name..."
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createRoom()}
            style={{ marginBottom: "1rem" }}
          />
          <div style={{ fontSize: "0.85rem", color: C.muted }}>
            Your address: <code style={{ color: C.text, fontSize: "0.8rem" }}>{playerAddress.slice(0, 12)}...</code>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginBottom: "2rem" }}>
          <button className="btn-primary" onClick={createRoom} disabled={loading} style={{ width: "100%" }}>
            🔥 Create Multiplayer Room
          </button>
          <button className="btn-secondary" onClick={createSoloRoom} disabled={loading} style={{ width: "100%" }}>
            🤖 Solo Arena (vs AI Bots)
          </button>
          <div style={{ textAlign: "center", color: C.muted, fontSize: "0.85rem", padding: "0.5rem 0" }}>— or —</div>
          <input
            type="text"
            placeholder="Enter room code..."
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && joinRoom()}
          />
          <button className="btn-outline" onClick={joinRoom} disabled={loading} style={{ width: "100%" }}>
            Join Room
          </button>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button className="btn-outline" onClick={() => setScreen("stats")} style={{ flex: 1 }}>📊 My Stats</button>
          <button className="btn-outline" onClick={() => setScreen("leaderboard")} style={{ flex: 1 }}>🏆 Leaderboard</button>
        </div>
      </div>
    </div>
  );

  const renderLobby = () => {
    if (!currentRoom) return null;
    const isHost = currentRoom.host === playerAddress;
    const isSolo = currentRoom.solo_mode === true;
    const canStart = isHost && currentRoom.players.length >= (isSolo ? 1 : 3);
    const myPlayer = currentRoom.players.find(p => p.address === playerAddress);

    return (
      <div style={{ minHeight: "100vh", background: C.bg, padding: "2rem 1.5rem" }} className="fadeIn">
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2rem", letterSpacing: "0.06em" }}>
                {isSolo ? "SOLO ARENA" : "LOBBY"}
              </div>
              <div style={{ color: C.muted, fontSize: "0.9rem" }}>Room: <strong>{currentRoom.room_code}</strong></div>
            </div>
            <div style={{ display: "flex", gap: "0.65rem" }}>
              <button className="btn-outline" onClick={copyRoomCode} style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>📋 Copy</button>
              <button className="btn-outline" onClick={goHome} style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>← Leave</button>
            </div>
          </div>

          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontWeight: 700, marginBottom: "1.25rem", fontSize: "1rem" }}>
              Players ({currentRoom.players.length}/5)
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {currentRoom.players.map((p) => (
                <div key={p.address} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.9rem 1rem",
                  borderRadius: 10,
                  background: p.address === playerAddress ? `${C.primary}10` : C.bg,
                  border: `1.5px solid ${p.address === playerAddress ? C.primary + "40" : C.border}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div style={{ fontSize: "1.5rem" }}>{p.address.startsWith("bot_") ? "🤖" : "👤"}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                        {p.name}
                        {p.address === currentRoom.host && <span style={{ color: C.fire, marginLeft: "0.5rem", fontSize: "0.8rem" }}>👑 HOST</span>}
                      </div>
                      <div style={{ color: C.muted, fontSize: "0.78rem" }}>{p.address.slice(0, 12)}...</div>
                    </div>
                  </div>
                  <div>
                    {p.ready ? (
                      <div style={{ color: C.secondary, fontWeight: 700, fontSize: "0.85rem" }}>✓ READY</div>
                    ) : (
                      <div style={{ color: C.muted, fontSize: "0.85rem" }}>Waiting...</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {!isSolo && (
            <div className="card" style={{ background: `${C.fire}10`, borderColor: `${C.fire}40`, marginBottom: "1.5rem" }}>
              <div style={{ fontSize: "0.9rem", color: C.text }}>
                <strong>Share this code:</strong> <span style={{ color: C.fire, fontWeight: 700, fontSize: "1.1rem" }}>{currentRoom.room_code}</span>
                <div style={{ color: C.muted, fontSize: "0.85rem", marginTop: "0.25rem" }}>Friends can join from the homepage</div>
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
            <div className="card" style={{ marginTop: "1.5rem", background: `${C.secondary}10`, borderColor: `${C.secondary}40` }}>
              <div style={{ fontSize: "0.9rem", color: C.text }}>
                <strong>🤖 AI Bot Lineup:</strong>
                <div style={{ marginTop: "0.75rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  {["AgreeBot", "DevilBot", "JokerBot", "ThinkBot"].map(bot => (
                    <div key={bot} style={{ fontSize: "0.85rem", color: C.muted }}>• {bot}</div>
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
    const mySubmission = Object.entries(currentRoom.submissions).find(([key]) => key.startsWith(playerAddress));
    const hasSubmitted = !!mySubmission;
    const isRound1 = currentRoom.status === "round_1";
    const isRound2 = currentRoom.status === "round_2";

    return (
      <div style={{ minHeight: "100vh", background: C.bg, padding: "2rem 1.5rem" }} className="fadeIn">
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2rem", letterSpacing: "0.06em" }}>
              {isRound1 ? "ROUND 1: HOT TAKES" : "ROUND 2: VOTING"}
            </div>
            <div style={{ color: C.muted, fontSize: "0.85rem" }}>Room: {currentRoom.room_code}</div>
          </div>

          {isRound1 && (
            <>
              {!hasSubmitted ? (
                <>
                  <div className="card" style={{ marginBottom: "1.5rem" }}>
                    <div style={{ fontWeight: 700, marginBottom: "1.25rem", fontSize: "1rem" }}>Choose Your Scenario</div>
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
                          <div style={{ fontWeight: 700, marginBottom: "0.3rem", color: selectedScenario === i ? C.primary : C.text }}>
                            {s.title}
                          </div>
                          <div style={{ fontSize: "0.85rem", color: C.muted }}>{s.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedScenario !== null && (
                    <div className="card slide-up" style={{ marginBottom: "1.5rem" }}>
                      <div style={{ fontWeight: 700, marginBottom: "1rem", fontSize: "1rem" }}>Your Stance</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "1.25rem" }}>
                        {[
                          { value: "genius", label: "🔥 Genius", class: "stance-genius" },
                          { value: "trash", label: "🗑️ Trash", class: "stance-trash" },
                          { value: "spicy", label: "😈 Spicy", class: "stance-spicy" },
                        ].map(({ value, label, class: className }) => (
                          <div
                            key={value}
                            onClick={() => setSelectedStance(value)}
                            className={className}
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

                      <div style={{ fontWeight: 700, marginBottom: "0.75rem", fontSize: "1rem" }}>Your Take (100 chars max)</div>
                      <textarea
                        placeholder="Write your hot take..."
                        value={takeText}
                        onChange={(e) => setTakeText(e.target.value.slice(0, 100))}
                        style={{ marginBottom: "0.5rem" }}
                      />
                      <div style={{ textAlign: "right", color: C.muted, fontSize: "0.85rem", marginBottom: "1rem" }}>
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
                  <div style={{ fontWeight: 700, fontSize: "1.25rem", marginBottom: "0.75rem" }}>Take Submitted!</div>
                  <div style={{ color: C.muted, marginBottom: "1.5rem" }}>Waiting for other players...</div>
                  <div className="pulse" style={{ color: C.fire, fontSize: "0.9rem" }}>
                    {currentRoom.players.filter(p => Object.keys(currentRoom.submissions).some(k => k.startsWith(p.address))).length}/{currentRoom.players.length} submitted
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
                    .filter(p => p.address !== playerAddress)
                    .map(p => {
                      const submission = Object.entries(currentRoom.submissions).find(([key]) => key.startsWith(p.address));
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
                            const voteKeys = Object.keys(newVotes);
                            const existingKey = voteKeys.find(k => newVotes[k] === p.address);
                            
                            if (existingKey) {
                              delete newVotes[existingKey];
                            } else {
                              newVotes[Date.now().toString()] = p.address;
                            }
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
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{p.name}</div>
                              <div style={{ fontSize: "0.78rem", color: C.muted }}>{scenario?.title}</div>
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
                              {data.stance === "genius" ? "🔥" : data.stance === "trash" ? "🗑️" : "😈"}
                            </div>
                          </div>
                          <div style={{ fontSize: "0.9rem", fontStyle: "italic", color: C.text }}>
                            "{data.take}"
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div style={{ marginBottom: "1rem", textAlign: "center", color: C.muted, fontSize: "0.85rem" }}>
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
    const { final_scores, ai_rankings, player_votes } = currentRoom.results;
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
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "3rem", letterSpacing: "0.06em" }}>
              {sortedScores[0]?.address === playerAddress ? "VICTORY!" : "GAME OVER"}
            </div>
          </div>

          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontWeight: 700, marginBottom: "1.25rem", fontSize: "1rem" }}>Final Scores</div>
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
                      background: score.address === playerAddress ? `${C.primary}10` : i === 0 ? `${C.gold}10` : C.bg,
                      border: `2px solid ${score.address === playerAddress ? C.primary + "40" : i === 0 ? C.gold + "40" : C.border}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                      <div style={{ fontSize: "1.5rem", minWidth: 32 }}>{medals[i] || `${i + 1}.`}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                          {score.player_name}
                          {score.address === playerAddress && <span style={{ color: C.muted, fontSize: "0.8rem" }}> (you)</span>}
                        </div>
                        <div style={{ fontSize: "0.78rem", color: C.muted" }}>
                          AI: {score.ai_points}pts · Votes: +{score.vote_bonus}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.75rem", color: i === 0 ? C.gold : C.text }}>
                      {score.total}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {ai_rankings && (
            <div className="card" style={{ marginBottom: "1.5rem" }}>
              <div style={{ fontWeight: 700, marginBottom: "1rem", fontSize: "1rem" }}>🤖 AI Judge Reasoning</div>
              {Object.entries(ai_rankings).map(([scenarioKey, rankings]: [string, any]) => {
                const scenarioIdx = parseInt(scenarioKey.replace("scenario_", ""));
                const scenario = currentRoom.scenarios[scenarioIdx];
                return (
                  <div key={scenarioKey} style={{ marginBottom: "1rem" }}>
                    <div style={{ fontWeight: 700, marginBottom: "0.5rem", color: C.fire, fontSize: "0.9rem" }}>
                      {scenario?.title || scenarioKey}
                    </div>
                    {Array.isArray(rankings) && rankings.map((rank: any) => {
                      const pName = currentRoom.players.find(p => p.address === rank.player)?.name || rank.player?.slice(0, 8) + "...";
                      return (
                        <div key={rank.player} style={{
                          display: "flex",
                          gap: "0.75rem",
                          padding: "0.75rem 0.85rem",
                          background: C.bg,
                          borderRadius: 8,
                          marginBottom: "0.5rem",
                        }}>
                          <div style={{ color: rank.rank === 1 ? C.gold : C.muted, fontWeight: 700, minWidth: 24, fontSize: "0.9rem" }}>
                            #{rank.rank}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                              {pName} · <span style={{ color: C.muted, fontWeight: 400 }}>{rank.score}pts</span>
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
            <button className="btn-outline" onClick={goHome}>🏠 Home</button>
          </div>
        </div>
      </div>
    );
  };

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
            <button className="btn-outline" style={{ padding: "0.6rem 1.1rem", fontSize: "0.85rem" }} onClick={goHome}>← Back</button>
          </div>

          {statsLoading ? (
            <div className="card" style={{ textAlign: "center", padding: "3rem", color: C.muted }}>
              <div className="spin" style={{ fontSize: "2.5rem" }}>🔥</div>
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
                    <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{stat.icon}</div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2.5rem", color: C.primary }}>
                      {stat.value}
                    </div>
                    <div style={{ color: C.muted, fontSize: "0.85rem" }}>{stat.label}</div>
                  </div>
                ))}
              </div>
              {myStats.best_performance && (
                <div className="card" style={{ background: `${C.gold}10`, borderColor: `${C.gold}40` }}>
                  <div style={{ color: C.gold, fontWeight: 700, marginBottom: "0.5rem", fontSize: "0.95rem" }}>
                    🏅 Best Performance
                  </div>
                  <div style={{ color: C.muted, fontSize: "0.9rem" }}>
                    Score: <strong style={{ color: C.text }}>{myStats.best_performance.score} pts</strong> in Game #{myStats.best_performance.game_id}
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2rem", letterSpacing: "0.06em" }}>🏆 LEADERBOARD</div>
          <div style={{ display: "flex", gap: "0.65rem" }}>
            <button className="btn-outline" style={{ padding: "0.6rem 1.1rem", fontSize: "0.85rem" }} onClick={loadLeaderboard}>
              ↻ Refresh
            </button>
            <button className="btn-outline" style={{ padding: "0.6rem 1.1rem", fontSize: "0.85rem" }} onClick={goHome}>
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
                  <div key={entry.address} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "1rem 1.1rem",
                    borderRadius: 10,
                    background: isMe ? `${C.primary}10` : i === 0 ? `${C.gold}08` : C.bg,
                    border: `1.5px solid ${isMe ? C.primary + "40" : i === 0 ? C.gold + "30" : C.border}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                      <div style={{ fontSize: "1.3rem", minWidth: 28 }}>{medals[i] || `${i + 1}.`}</div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                          {entry.address.slice(0, 10)}...
                          {isMe && <span style={{ color: C.muted, fontWeight: 400, fontSize: "0.78rem" }}> (you)</span>}
                        </div>
                        <div style={{ color: C.muted, fontSize: "0.78rem" }}>
                          {entry.games_played} games · {entry.wins} wins
                        </div>
                      </div>
                    </div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.6rem", color: i === 0 ? C.gold : C.text }}>
                      {entry.total_points} <span style={{ fontSize: "0.65rem", color: C.muted }}>pts</span>
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
          <div style={{ fontWeight: 700, color: C.primary, marginBottom: "0.75rem", fontSize: "1.1rem" }}>Configuration Error</div>
          <div style={{ color: C.muted, marginBottom: "1rem", fontSize: "0.95rem" }}>{envError}</div>
          <code style={{ display: "block", background: C.bg, padding: "0.85rem", borderRadius: 8, fontSize: "0.85rem", color: C.text, border: `1px solid ${C.border}` }}>
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

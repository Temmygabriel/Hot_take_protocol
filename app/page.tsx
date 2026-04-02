"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

// ============================================
// TYPES (match contract)
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

// ============================================
// CONTRACT HELPERS
// ============================================
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
if (!CONTRACT_ADDRESS) {
  throw new Error("Missing NEXT_PUBLIC_CONTRACT_ADDRESS env variable");
}

// Get or create a persistent account (store in localStorage)
function getAccount() {
  const stored = localStorage.getItem("genlayer_account");
  if (stored) {
    return JSON.parse(stored);
  }
  const account = createAccount();
  localStorage.setItem("genlayer_account", JSON.stringify(account));
  return account;
}

function getClient() {
  const account = getAccount();
  return createClient({ chain: studionet, account });
}

async function readContract(functionName: string, args: any[]): Promise<any> {
  const client = getClient();
  const result = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
  });
  return result;
}

async function writeContract(functionName: string, args: any[]): Promise<void> {
  const client = getClient();
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
    value: BigInt(0),
    leaderOnly: true, // faster
  });
  await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    retries: 60,
    interval: 3000,
  });
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function HotTakeProtocol() {
  // State
  const [screen, setScreen] = useState<Screen>("landing");
  const [playerAddress, setPlayerAddress] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("");
  const [roomCode, setRoomCode] = useState<string>("");
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<number | null>(null);
  const [stance, setStance] = useState<string>("");
  const [hotTake, setHotTake] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  // Load player address from account
  useEffect(() => {
    const account = getAccount();
    setPlayerAddress(account.address);
  }, []);

  // Poll room updates when in lobby/game
  const fetchRoom = useCallback(async (code: string) => {
    try {
      const roomJson = await readContract("get_room", [code]);
      if (roomJson) {
        const room: Room = JSON.parse(roomJson as string);
        setCurrentRoom(room);
        // Auto-advance screen based on room status
        if (room.status === "round_1" && screen === "lobby") {
          setScreen("game");
        } else if (room.status === "round_2" && screen === "game") {
          setScreen("game"); // stay in game screen but show voting
        } else if (room.status === "completed" && screen !== "results") {
          setScreen("results");
        }
      }
    } catch (err) {
      console.error("Failed to fetch room", err);
    }
  }, [screen]);

  useEffect(() => {
    if (roomCode && (screen === "lobby" || screen === "game")) {
      fetchRoom(roomCode);
      pollInterval.current = setInterval(() => fetchRoom(roomCode), 4000);
      return () => {
        if (pollInterval.current) clearInterval(pollInterval.current);
      };
    }
  }, [roomCode, screen, fetchRoom]);

  // Contract actions
  const createRoom = async (isSolo: boolean = false) => {
    if (!playerName) return;
    setLoading(true);
    try {
      let code: string;
      if (isSolo) {
        code = await writeContract("create_solo_room", [playerAddress, playerName]);
      } else {
        code = await writeContract("create_room", [playerAddress, playerName]);
      }
      setRoomCode(code);
      await fetchRoom(code);
      setScreen("lobby");
    } catch (err) {
      console.error(err);
      alert("Failed to create room. Check console.");
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async (code: string) => {
    if (!playerName) return;
    setLoading(true);
    try {
      await writeContract("join_room", [code, playerAddress, playerName]);
      setRoomCode(code);
      await fetchRoom(code);
      setScreen("lobby");
    } catch (err) {
      console.error(err);
      alert("Failed to join room. It may be full or invalid.");
    } finally {
      setLoading(false);
    }
  };

  const toggleReady = async () => {
    if (!roomCode) return;
    setLoading(true);
    try {
      await writeContract("toggle_ready", [roomCode, playerAddress]);
      await fetchRoom(roomCode);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const startGame = async () => {
    if (!roomCode || !currentRoom) return;
    setLoading(true);
    try {
      await writeContract("start_game", [roomCode, playerAddress]);
      // Game will advance; polling will update
    } catch (err) {
      console.error(err);
      alert("Failed to start game. Need at least 3 players?");
    } finally {
      setLoading(false);
    }
  };

  const submitTake = async () => {
    if (!roomCode || selectedScenario === null || !stance || !hotTake.trim()) return;
    setLoading(true);
    try {
      await writeContract("submit_take", [roomCode, playerAddress, selectedScenario, stance, hotTake]);
      setSubmitted(true);
      // Optionally, host could call advance_to_voting after all submits, but we'll let host do that via a button
    } catch (err) {
      console.error(err);
      alert("Failed to submit take.");
    } finally {
      setLoading(false);
    }
  };

  const advanceToVoting = async () => {
    if (!roomCode) return;
    setLoading(true);
    try {
      await writeContract("advance_to_voting", [roomCode]);
      await fetchRoom(roomCode);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const calculateResults = async () => {
    if (!roomCode) return;
    setLoading(true);
    try {
      await writeContract("calculate_results", [roomCode]);
      await fetchRoom(roomCode);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Helper to generate a room code (only for UI, contract generates its own)
  const generateMockRoomCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  };

  // Styles (unchanged from your original)
  const colors = {
    bg: "#F5F7FA",
    card: "#FFFFFF",
    text: "#1A202C",
    primary: "#FF3D00",
    secondary: "#00E676",
    accent1: "#FF6D00",
    accent2: "#D500F9",
  };

  const containerStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: colors.bg,
    fontFamily: "Inter, sans-serif",
    color: colors.text,
  };

  const cardStyle: React.CSSProperties = {
    background: colors.card,
    borderRadius: 20,
    padding: "2rem",
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
  };

  const buttonStyle: React.CSSProperties = {
    padding: "1rem 2rem",
    border: "none",
    borderRadius: 12,
    fontFamily: "Space Grotesk, sans-serif",
    fontWeight: 700,
    fontSize: "1rem",
    cursor: "pointer",
    transition: "all 0.2s",
    background: `linear-gradient(135deg, ${colors.primary}, ${colors.accent1})`,
    color: "white",
  };

  const secondaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    background: colors.card,
    color: colors.text,
    border: `2px solid ${colors.primary}`,
  };

  // Render functions (same as original but with real actions)
  const renderLanding = () => (
    <div style={containerStyle}>
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "4rem 2rem", textAlign: "center" }}>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🔥</div>
          <h1
            style={{
              fontFamily: "Space Grotesk, sans-serif",
              fontSize: "3rem",
              fontWeight: 700,
              marginBottom: "0.5rem",
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.accent2})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            HOT TAKE PROTOCOL
          </h1>
          <p style={{ fontSize: "1.1rem", color: "#64748B", marginBottom: "3rem" }}>
            5-player debate game • AI judges • 10 minutes
          </p>
        </motion.div>

        {!playerName && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            style={{ ...cardStyle, marginBottom: "2rem" }}
          >
            <p style={{ marginBottom: "1rem", fontWeight: 600 }}>Enter your name to start</p>
            <input
              type="text"
              placeholder="Your name..."
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              style={{
                width: "100%",
                padding: "1rem",
                border: `2px solid ${colors.primary}`,
                borderRadius: 12,
                fontSize: "1rem",
                fontFamily: "Inter, sans-serif",
                outline: "none",
                boxSizing: "border-box",
              }}
              onKeyPress={(e) => e.key === "Enter" && playerName.trim() && null}
            />
          </motion.div>
        )}

        {playerName && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <button style={buttonStyle} onClick={() => createRoom(false)} disabled={loading}>
              {loading ? "Creating..." : "CREATE ROOM"}
            </button>

            <button
              style={secondaryButtonStyle}
              onClick={() => {
                const code = prompt("Enter room code:");
                if (code) joinRoom(code);
              }}
            >
              JOIN ROOM
            </button>

            <button
              style={{ ...secondaryButtonStyle, borderColor: colors.secondary, color: colors.secondary }}
              onClick={() => createRoom(true)}
              disabled={loading}
            >
              SOLO ARENA
              <div style={{ fontSize: "0.8rem", fontWeight: 400, marginTop: "0.25rem" }}>
                Play with AI bots
              </div>
            </button>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          style={{ marginTop: "4rem" }}
        >
          <h3 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "1rem" }}>Recent Games</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {["A8F3", "K2L9", "P7M4"].map((code, i) => (
              <div
                key={code}
                style={{
                  ...cardStyle,
                  padding: "1rem 1.5rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                }}
                onClick={() => joinRoom(code)}
              >
                <div>
                  <span style={{ fontFamily: "JetBrains Mono", fontWeight: 600 }}>Room #{code}</span>
                  <span style={{ marginLeft: "1rem", color: "#64748B", fontSize: "0.9rem" }}>
                    {i + 2} min ago
                  </span>
                </div>
                <span style={{ color: colors.primary, fontSize: "0.9rem", fontWeight: 600 }}>Join →</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );

  const renderLobby = () => {
    if (!currentRoom) return null;
    const isHost = currentRoom.host === playerAddress;
    const readyCount = currentRoom.players.filter((p) => p.ready).length;
    const canStart = isHost && currentRoom.players.length >= 3;

    return (
      <div style={containerStyle}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "4rem 2rem" }}>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ ...cardStyle, marginBottom: "2rem", textAlign: "center" }}
          >
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "1rem" }}>
              <span style={{ fontSize: "0.9rem", color: "#64748B" }}>ROOM CODE:</span>
              <span
                style={{
                  fontFamily: "JetBrains Mono",
                  fontSize: "2rem",
                  fontWeight: 700,
                  color: colors.primary,
                }}
              >
                {currentRoom.room_code}
              </span>
              <button
                style={{
                  ...buttonStyle,
                  padding: "0.5rem 1rem",
                  fontSize: "0.85rem",
                }}
                onClick={() => {
                  navigator.clipboard.writeText(currentRoom.room_code);
                  alert("Room code copied!");
                }}
              >
                COPY
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={cardStyle}
          >
            <h2 style={{ marginBottom: "1.5rem", fontFamily: "Space Grotesk" }}>Players</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {currentRoom.players.map((player) => (
                <div
                  key={player.address}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "1rem",
                    background: player.address === playerAddress ? "rgba(255, 61, 0, 0.05)" : "#F8FAFC",
                    borderRadius: 12,
                    border: player.address === playerAddress ? `2px solid ${colors.primary}` : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: `linear-gradient(135deg, ${colors.primary}, ${colors.accent2})`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontWeight: 700,
                      }}
                    >
                      {player.name[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {player.name}
                        {player.address === currentRoom.host && (
                          <span
                            style={{
                              marginLeft: "0.5rem",
                              fontSize: "0.75rem",
                              padding: "0.25rem 0.5rem",
                              background: colors.accent1,
                              color: "white",
                              borderRadius: 6,
                            }}
                          >
                            HOST
                          </span>
                        )}
                        {player.address === playerAddress && (
                          <span
                            style={{
                              marginLeft: "0.5rem",
                              fontSize: "0.75rem",
                              color: colors.primary,
                            }}
                          >
                            (You)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    {player.ready ? (
                      <span style={{ color: colors.secondary, fontWeight: 600 }}>✅ Ready</span>
                    ) : (
                      <span style={{ color: "#94A3B8" }}>⏳ Not Ready</span>
                    )}
                  </div>
                </div>
              ))}

              {[...Array(5 - currentRoom.players.length)].map((_, i) => (
                <div
                  key={`empty-${i}`}
                  style={{
                    padding: "1rem",
                    background: "#F8FAFC",
                    borderRadius: 12,
                    border: "2px dashed #CBD5E1",
                    color: "#94A3B8",
                    textAlign: "center",
                  }}
                >
                  ⏳ Waiting for player {currentRoom.players.length + i + 1}...
                </div>
              ))}
            </div>

            <div style={{ marginTop: "2rem", display: "flex", gap: "1rem", justifyContent: "center" }}>
              {isHost ? (
                <button
                  style={{
                    ...buttonStyle,
                    opacity: canStart ? 1 : 0.5,
                    cursor: canStart ? "pointer" : "not-allowed",
                  }}
                  onClick={startGame}
                  disabled={!canStart || loading}
                >
                  {loading ? "Starting..." : `START GAME (${readyCount}/${currentRoom.players.length} ready)`}
                </button>
              ) : (
                <button style={buttonStyle} onClick={toggleReady} disabled={loading}>
                  {currentRoom.players.find((p) => p.address === playerAddress)?.ready
                    ? "MARK NOT READY"
                    : "MARK READY"}
                </button>
              )}

              <button
                style={secondaryButtonStyle}
                onClick={() => {
                  setScreen("landing");
                  setCurrentRoom(null);
                  setRoomCode("");
                }}
              >
                LEAVE ROOM
              </button>
            </div>

            {!isHost && (
              <p style={{ marginTop: "1rem", textAlign: "center", color: "#64748B", fontSize: "0.9rem" }}>
                Waiting for host to start...
              </p>
            )}

            {isHost && !canStart && (
              <p style={{ marginTop: "1rem", textAlign: "center", color: colors.accent1, fontSize: "0.9rem" }}>
                Need at least 3 players to start
              </p>
            )}
          </motion.div>
        </div>
      </div>
    );
  };

  const renderGame = () => {
    if (!currentRoom || !currentRoom.scenarios.length) return null;
    const isHost = currentRoom.host === playerAddress;
    const allSubmitted = currentRoom.status === "round_2"; // after host advances

    return (
      <div style={containerStyle}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "4rem 2rem" }}>
          <div style={{ marginBottom: "2rem", textAlign: "center" }}>
            <h2 style={{ fontFamily: "Space Grotesk", fontSize: "1.5rem", marginBottom: "0.5rem" }}>
              {currentRoom.status === "round_1" ? "ROUND 1: SUBMIT YOUR TAKE" : "ROUND 2: VOTING PHASE"}
            </h2>
            <p style={{ color: "#64748B" }}>Room {currentRoom.room_code}</p>
          </div>

          {currentRoom.status === "round_1" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
                {currentRoom.scenarios.map((scenario) => (
                  <motion.div
                    key={scenario.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: scenario.id * 0.1 }}
                    style={{
                      ...cardStyle,
                      cursor: "pointer",
                      border: selectedScenario === scenario.id ? `3px solid ${colors.primary}` : "none",
                      transform: selectedScenario === scenario.id ? "scale(1.02)" : "scale(1)",
                    }}
                    onClick={() => !submitted && setSelectedScenario(scenario.id)}
                  >
                    <div style={{ fontSize: "2rem", marginBottom: "1rem", textAlign: "center" }}>
                      {scenario.type === "art" ? "🎨" : scenario.type === "business" ? "💼" : "🌐"}
                    </div>
                    <h3 style={{ fontFamily: "Space Grotesk", fontSize: "1.1rem", marginBottom: "0.75rem", textAlign: "center" }}>
                      {scenario.title}
                    </h3>
                    <p style={{ fontSize: "0.9rem", color: "#64748B", marginBottom: "0.75rem", textAlign: "center" }}>
                      {scenario.description}
                    </p>
                    <p style={{ fontSize: "0.85rem", color: colors.text, padding: "0.75rem", background: "#F8FAFC", borderRadius: 8, textAlign: "center" }}>
                      "{scenario.content}"
                    </p>
                  </motion.div>
                ))}
              </div>

              {!submitted && selectedScenario !== null && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ ...cardStyle, marginTop: "2rem" }}
                >
                  <h3 style={{ marginBottom: "1rem", fontFamily: "Space Grotesk" }}>Your Hot Take</h3>
                  <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
                    {[
                      { value: "genius", label: "🔥 Genius", color: colors.secondary },
                      { value: "trash", label: "🗑️ Trash", color: colors.primary },
                      { value: "spicy", label: "😈 Spicy", color: colors.accent2 },
                    ].map((s) => (
                      <button
                        key={s.value}
                        style={{
                          flex: 1,
                          padding: "1rem",
                          border: stance === s.value ? `3px solid ${s.color}` : "2px solid #E2E8F0",
                          background: stance === s.value ? `${s.color}15` : "white",
                          borderRadius: 12,
                          cursor: "pointer",
                          fontFamily: "Space Grotesk",
                          fontWeight: 600,
                          fontSize: "1rem",
                          transition: "all 0.2s",
                        }}
                        onClick={() => setStance(s.value)}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    placeholder="Write your hot take (max 100 chars)..."
                    value={hotTake}
                    onChange={(e) => {
                      if (e.target.value.length <= 100) setHotTake(e.target.value);
                    }}
                    style={{
                      width: "100%",
                      minHeight: 100,
                      padding: "1rem",
                      border: `2px solid ${colors.primary}`,
                      borderRadius: 12,
                      fontSize: "1rem",
                      fontFamily: "Inter, sans-serif",
                      resize: "vertical",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  <div style={{ textAlign: "right", fontSize: "0.85rem", color: "#64748B", marginTop: "0.5rem" }}>
                    {hotTake.length}/100
                  </div>
                  <button
                    style={{
                      ...buttonStyle,
                      width: "100%",
                      marginTop: "1rem",
                      opacity: stance && hotTake.length > 10 ? 1 : 0.5,
                      cursor: stance && hotTake.length > 10 ? "pointer" : "not-allowed",
                    }}
                    onClick={submitTake}
                    disabled={!stance || hotTake.length < 10 || loading}
                  >
                    {loading ? "Submitting..." : "SUBMIT TAKE"}
                  </button>
                </motion.div>
              )}

              {submitted && (
                <div style={{ ...cardStyle, marginTop: "2rem", textAlign: "center", padding: "2rem" }}>
                  <p style={{ fontSize: "1.2rem", color: colors.secondary }}>✅ Take submitted!</p>
                  <p style={{ marginTop: "0.5rem", color: "#64748B" }}>Waiting for other players...</p>
                  {isHost && (
                    <button style={{ ...buttonStyle, marginTop: "1rem" }} onClick={advanceToVoting} disabled={loading}>
                      {loading ? "Advancing..." : "Advance to Voting (Host)"}
                    </button>
                  )}
                </div>
              )}

              {!selectedScenario && !submitted && (
                <div style={{ ...cardStyle, marginTop: "2rem", textAlign: "center", padding: "3rem" }}>
                  <p style={{ fontSize: "1.1rem", color: "#64748B" }}>👆 Select a scenario to submit your hot take</p>
                </div>
              )}
            </>
          )}

          {currentRoom.status === "round_2" && (
            <div style={{ ...cardStyle, textAlign: "center", padding: "3rem" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🗳️</div>
              <h3 style={{ fontFamily: "Space Grotesk", marginBottom: "0.5rem" }}>Voting Phase</h3>
              <p style={{ color: "#64748B", marginBottom: "1.5rem" }}>
                (Voting UI would go here – see contract's submit_votes method)
              </p>
              {isHost && (
                <button style={buttonStyle} onClick={calculateResults} disabled={loading}>
                  {loading ? "Calculating..." : "Calculate Final Results"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderResults = () => {
    if (!currentRoom || !currentRoom.results) return null;
    const scores = currentRoom.results.final_scores;
    const sortedPlayers = Object.entries(scores).sort((a: any, b: any) => b[1].total - a[1].total);

    return (
      <div style={containerStyle}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "4rem 2rem", textAlign: "center" }}>
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🏆</div>
            <h1 style={{ fontFamily: "Space Grotesk", fontSize: "2.5rem", marginBottom: "0.5rem" }}>GAME OVER</h1>
            <p style={{ color: "#64748B", marginBottom: "3rem" }}>Room {currentRoom.room_code}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={cardStyle}
          >
            <h2 style={{ marginBottom: "2rem", fontFamily: "Space Grotesk" }}>Final Standings</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {sortedPlayers.map(([address, data]: any, i) => {
                const isWinner = i === 0;
                const isPlayer = address === playerAddress;
                return (
                  <div
                    key={address}
                    style={{
                      padding: "1.5rem",
                      background: isWinner
                        ? `linear-gradient(135deg, ${colors.accent1}, ${colors.primary})`
                        : isPlayer
                        ? "rgba(255, 61, 0, 0.05)"
                        : "#F8FAFC",
                      borderRadius: 12,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      border: isPlayer && !isWinner ? `2px solid ${colors.primary}` : "none",
                      color: isWinner ? "white" : colors.text,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      <div style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "Space Grotesk" }}>{i + 1}.</div>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>
                          {data.player_name}
                          {isPlayer && <span style={{ marginLeft: "0.5rem", fontSize: "0.9rem" }}>(You)</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "JetBrains Mono" }}>
                        {data.total}
                      </div>
                      <div style={{ fontSize: "0.9rem" }}>pts</div>
                      {isWinner && <span style={{ marginLeft: "0.5rem" }}>⭐</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: "2rem", display: "flex", gap: "1rem", justifyContent: "center" }}>
              <button style={buttonStyle} onClick={() => createRoom(false)}>
                PLAY AGAIN
              </button>
              <button style={secondaryButtonStyle} onClick={() => setScreen("landing")}>
                BACK TO HOME
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  };

  const renderStats = () => (
    <div style={{ ...containerStyle, minHeight: "100vh", padding: "4rem 2rem" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "Space Grotesk", marginBottom: "2rem" }}>Your Stats</h1>
        <div style={cardStyle}>
          <p>Stats feature coming soon...</p>
          <button style={{ ...buttonStyle, marginTop: "2rem" }} onClick={() => setScreen("landing")}>
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );

  const renderLeaderboard = () => (
    <div style={{ ...containerStyle, minHeight: "100vh", padding: "4rem 2rem" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "Space Grotesk", marginBottom: "2rem" }}>Global Leaderboard</h1>
        <div style={cardStyle}>
          <p>Leaderboard feature coming soon...</p>
          <button style={{ ...buttonStyle, marginTop: "2rem" }} onClick={() => setScreen("landing")}>
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );

  return <div>{renderScreen()}</div>;
}

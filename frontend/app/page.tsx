"use client";
// Hot Take Protocol - Main Orchestrator v1.0

import { useState, useEffect, useRef, useCallback } from "react";
import { Screen, Room, Stance } from "../types";
import {
  makeAccount,
  writeContract,
  writeContractWithReturn,
  getRoom,
} from "../lib/contract";

import LandingScreen from "../components/LandingScreen";
import LobbyScreen from "../components/LobbyScreen";
import Round1Screen from "../components/Round1Screen";
import Round2Screen from "../components/Round2Screen";
import ResultsScreen from "../components/ResultsScreen";
import RejoinScreen from "../components/RejoinScreen";
import LeaderboardScreen from "../components/LeaderboardScreen";

const POLL_INTERVAL = 3000;
const ADVANCE_FALLBACK = 60_000;
const CALC_FALLBACK = 30_000;

export default function HotTakeProtocol() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [room, setRoom] = useState<Room | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [voted, setVoted] = useState(false);

  const accountRef = useRef<ReturnType<typeof makeAccount> | null>(null);
  const playerAddressRef = useRef<string>("");
  const screenRef = useRef<Screen>("landing");
  const pollRoomCodeRef = useRef<string>("");
  const calculatingRef = useRef(false);
  const advancingRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const allSubmittedAtRef = useRef<number>(0);
  const allVotesAtRef = useRef<number>(0);

  useEffect(() => {
    const saved = localStorage.getItem("htp_address");
    const savedName = localStorage.getItem("htp_name");
    if (saved) {
      playerAddressRef.current = saved;
    } else {
      const acc = makeAccount();
      accountRef.current = acc;
      playerAddressRef.current = acc.address;
      localStorage.setItem("htp_address", acc.address);
    }
    if (savedName) setPlayerName(savedName);
    if (!accountRef.current) {
      accountRef.current = makeAccount();
    }
  }, []);

  useEffect(() => { screenRef.current = screen; }, [screen]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback((code: string) => {
    stopPolling();
    pollRoomCodeRef.current = code;

    const poll = async () => {
      if (!pollRoomCodeRef.current) return;
      if (!["lobby","round1","round1_waiting","round2","round2_waiting"].includes(screenRef.current)) return;

      try {
        const data: Room = await getRoom(pollRoomCodeRef.current);
        if (!data || !data.code) return;
        setRoom(data);

        const myAddr = playerAddressRef.current;
        const isHost = data.host === myAddr;
        const humanPlayers = Object.keys(data.players).filter((id) => !id.startsWith("bot_"));

        if (data.status === "lobby") { setScreen("lobby"); return; }

        if (data.status === "round_1") {
          const humanSubmitted = humanPlayers.filter((id) => data.submissions[id]).length;
          const allHumanSubmitted = humanSubmitted === humanPlayers.length;
          if (!data.submissions[myAddr]) { setScreen("round1"); } else { setScreen("round1_waiting"); }
          if (allHumanSubmitted && !advancingRef.current) {
            if (allSubmittedAtRef.current === 0) allSubmittedAtRef.current = Date.now();
            const elapsed = Date.now() - allSubmittedAtRef.current;
            if (isHost || elapsed > ADVANCE_FALLBACK) {
              advancingRef.current = true;
              try { await writeContract(accountRef.current!, "advance_to_voting", [pollRoomCodeRef.current]); }
              catch { advancingRef.current = false; }
            }
          }
          return;
        }

        if (data.status === "round_2") {
          allSubmittedAtRef.current = 0;
          const humanVotes = humanPlayers.filter((id) => data.votes[id]).length;
          const allVoted = humanVotes === humanPlayers.length;
          if (!data.votes[myAddr]) { setScreen("round2"); } else { setScreen("round2_waiting"); }
          if (allVoted && !calculatingRef.current) {
            if (allVotesAtRef.current === 0) allVotesAtRef.current = Date.now();
            const elapsed = Date.now() - allVotesAtRef.current;
            if (isHost || elapsed > CALC_FALLBACK) {
              calculatingRef.current = true;
              try { await writeContract(accountRef.current!, "calculate_results", [pollRoomCodeRef.current]); }
              catch { calculatingRef.current = false; }
            }
          }
          return;
        }

        if (data.status === "completed") {
          allVotesAtRef.current = 0;
          stopPolling();
          setScreen("results");
        }
      } catch { /* Network blip */ }
    };

    poll();
    pollTimerRef.current = setInterval(poll, POLL_INTERVAL);
  }, [stopPolling]);

  useEffect(() => { return () => stopPolling(); }, [stopPolling]);

  function getAccount() {
    if (!accountRef.current) {
      accountRef.current = makeAccount();
      playerAddressRef.current = accountRef.current.address;
      localStorage.setItem("htp_address", playerAddressRef.current);
    }
    return accountRef.current;
  }

  async function handleCreateRoom(name: string) {
    if (!name.trim()) return;
    setLoading("Creating room...");
    setError("");
    const acc = getAccount();
    localStorage.setItem("htp_name", name);
    setPlayerName(name);
    try {
      const code = await writeContractWithReturn(acc, "create_room", [acc.address, name]);
      setRoomCode(code);
      setSubmitted(false); setVoted(false);
      advancingRef.current = false; calculatingRef.current = false;
      allSubmittedAtRef.current = 0; allVotesAtRef.current = 0;
      setScreen("lobby");
      startPolling(code);
    } catch (e: any) {
      console.error("handleCreateRoom failed:", e?.message, e);
      setError("Failed to create room. Try again.");
    } finally { setLoading(""); }
  }

  async function handleJoinRoom(code: string, name: string) {
    if (!code.trim() || !name.trim()) return;
    setLoading("Joining room...");
    setError("");
    const acc = getAccount();
    localStorage.setItem("htp_name", name);
    setPlayerName(name);
    try {
      await writeContract(acc, "join_room", [code.toUpperCase(), acc.address, name]);
      setRoomCode(code.toUpperCase());
      setSubmitted(false); setVoted(false);
      advancingRef.current = false; calculatingRef.current = false;
      allSubmittedAtRef.current = 0; allVotesAtRef.current = 0;
      setScreen("lobby");
      startPolling(code.toUpperCase());
    } catch {
      setError("Could not join room. Check the code.");
    } finally { setLoading(""); }
  }

  async function handleSoloArena(name: string) {
    const playerN = name || playerName || "Player";
    setLoading("Setting up Solo Arena...");
    setError("");
    const acc = getAccount();
    localStorage.setItem("htp_name", playerN);
    setPlayerName(playerN);
    try {
      const code = await writeContractWithReturn(acc, "create_solo_room", [acc.address, playerN]);
      setRoomCode(code);
      setSubmitted(false); setVoted(false);
      advancingRef.current = false; calculatingRef.current = false;
      allSubmittedAtRef.current = 0; allVotesAtRef.current = 0;
      setScreen("round1");
      startPolling(code);
    } catch {
      setError("Failed to start Solo Arena. Try again.");
    } finally { setLoading(""); }
  }

  async function handleToggleReady() {
    if (!roomCode) return;
    setLoading("Updating...");
    const acc = getAccount();
    try { await writeContract(acc, "toggle_ready", [roomCode, acc.address]); }
    catch { /* silent */ }
    finally { setLoading(""); }
  }

  async function handleStartGame() {
    if (!roomCode) return;
    setLoading("Starting game...");
    const acc = getAccount();
    try { await writeContract(acc, "start_game", [roomCode, acc.address]); }
    catch { setError("Could not start game."); }
    finally { setLoading(""); }
  }

  async function handleSubmitTake(scenarioId: number, stance: Stance, take: string) {
    if (!roomCode) return;
    setLoading("Submitting take...");
    const acc = getAccount();
    try {
      await writeContract(acc, "submit_take", [roomCode, acc.address, scenarioId, stance, take]);
      setSubmitted(true);
    } catch { setError("Could not submit take."); }
    finally { setLoading(""); }
  }

  async function handleSubmitVotes(votes: Record<string, number>) {
    if (!roomCode) return;
    setLoading("Submitting votes...");
    const acc = getAccount();
    try {
      await writeContract(acc, "submit_votes", [roomCode, acc.address, JSON.stringify(votes)]);
      setVoted(true);
    } catch { setError("Could not submit votes."); }
    finally { setLoading(""); }
  }

  function handleRejoin(rejoinedRoom: Room, code: string) {
    setRoom(rejoinedRoom);
    setRoomCode(code);
    setSubmitted(!!rejoinedRoom.submissions[playerAddressRef.current]);
    setVoted(!!rejoinedRoom.votes[playerAddressRef.current]);
    advancingRef.current = false; calculatingRef.current = false;
    allSubmittedAtRef.current = 0; allVotesAtRef.current = 0;
    if (rejoinedRoom.status === "completed") { stopPolling(); setScreen("results"); }
    else if (rejoinedRoom.status === "round_1") { setScreen("round1"); startPolling(code); }
    else if (rejoinedRoom.status === "round_2") { setScreen("round2"); startPolling(code); }
    else { setScreen("lobby"); startPolling(code); }
  }

  function handlePlayAgain() {
    stopPolling();
    setRoom(null); setRoomCode(""); setSubmitted(false); setVoted(false); setError("");
    setScreen("landing");
  }

  const playerAddress = playerAddressRef.current;
  const isHost = room ? room.host === playerAddress : false;

  const renderScreen = () => {
    switch (screen) {
      case "landing":
        return (
          <LandingScreen
            onNavigate={setScreen}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onSolo={handleSoloArena}
            soloLoading={loading === "Setting up Solo Arena..."}
            createLoading={loading === "Creating room..."}
            joinLoading={loading === "Joining room..."}
            error={error}
          />
        );
      case "lobby":
        if (!room) return null;
        return (
          <LobbyScreen
            room={room}
            playerAddress={playerAddress}
            isHost={isHost}
            onToggleReady={handleToggleReady}
            onStartGame={handleStartGame}
            loading={loading}
          />
        );
      case "round1":
      case "round1_waiting":
        if (!room) return null;
        return (
          <Round1Screen
            room={room}
            playerAddress={playerAddress}
            onSubmit={handleSubmitTake}
            loading={loading}
            submitted={submitted}
          />
        );
      case "round2":
      case "round2_waiting":
        if (!room) return null;
        return (
          <Round2Screen
            room={room}
            playerAddress={playerAddress}
            onSubmitVotes={handleSubmitVotes}
            loading={loading}
            voted={voted}
          />
        );
      case "results":
        if (!room) return null;
        return (
          <ResultsScreen
            room={room}
            playerAddress={playerAddress}
            onPlayAgain={handlePlayAgain}
            onHome={handlePlayAgain}
          />
        );
      case "rejoin":
        return (
          <RejoinScreen
            playerAddress={playerAddress}
            onRejoin={handleRejoin}
            onBack={() => setScreen("landing")}
          />
        );
      case "leaderboard":
        return (
          <LeaderboardScreen
            playerAddress={playerAddress}
            onBack={() => setScreen("landing")}
          />
        );
      default:
        return null;
    }
  };

  return (
    <main className="app-root">
      <div className="app-container">{renderScreen()}</div>
    </main>
  );
}

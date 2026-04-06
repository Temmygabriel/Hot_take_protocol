"use client";
// Hot Take Protocol - Main Orchestrator
// v1.0
// This file manages: screen routing, player identity, polling engine,
// all contract write calls, and passing handlers down to screen components.

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

// --------------------------------------------------------------------------
// Polling config
// --------------------------------------------------------------------------
const POLL_INTERVAL = 3000;

// Fallback timers (ms)
const ADVANCE_FALLBACK = 60_000;   // 60s after all submitted, any player can advance
const CALC_FALLBACK = 30_000;      // 30s after all voted, any player can calculate

export default function HotTakeProtocol() {
  // ---- State ----
  const [screen, setScreen] = useState<Screen>("landing");
  const [room, setRoom] = useState<Room | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [voted, setVoted] = useState(false);

  // ---- Refs for stale closure safety ----
  const accountRef = useRef<ReturnType<typeof makeAccount> | null>(null);
  const playerAddressRef = useRef<string>("");
  const screenRef = useRef<Screen>("landing");
  const pollRoomCodeRef = useRef<string>("");
  const calculatingRef = useRef(false);
  const advancingRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timestamps for fallback timers
  const allSubmittedAtRef = useRef<number>(0);
  const allVotesAtRef = useRef<number>(0);

  // ---- Init: restore identity from localStorage ----
  useEffect(() => {
    const saved = localStorage.getItem("htp_address");
    const savedName = localStorage.getItem("htp_name");
    if (saved) {
      playerAddressRef.current = saved;
    } else {
      const acc = makeAccount();
      accountRef.current = acc;
      const addr = acc.address;
      playerAddressRef.current = addr;
      localStorage.setItem("htp_address", addr);
    }
    if (savedName) setPlayerName(savedName);
    if (!accountRef.current) {
      accountRef.current = makeAccount();
    }
  }, []);

  // Keep screenRef in sync
  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  // ---- Polling Engine ----
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (code: string) => {
      stopPolling();
      pollRoomCodeRef.current = code;

      const poll = async () => {
        if (!pollRoomCodeRef.current) return;
        if (
          ![
            "lobby",
            "round1",
            "round1_waiting",
            "round2",
            "round2_waiting",
          ].includes(screenRef.current)
        )
          return;

        try {
          const data: Room = await getRoom(pollRoomCodeRef.current);
          if (!data || !data.code) return;
          setRoom(data);

          const myAddr = playerAddressRef.current;
          const isHost = data.host === myAddr;
          const humanPlayers = Object.keys(data.players).filter(
            (id) => !id.startsWith("bot_")
          );

          // ---- LOBBY ----
          if (data.status === "lobby") {
            setScreen("lobby");
            return;
          }

          // ---- ROUND 1 ----
          if (data.status === "round_1") {
            const humanSubmitted = humanPlayers.filter(
              (id) => data.submissions[id]
            ).length;
            const allHumanSubmitted = humanSubmitted === humanPlayers.length;

            if (!data.submissions[myAddr]) {
              setScreen("round1");
            } else {
              setScreen("round1_waiting");
            }

            if (allHumanSubmitted && !advancingRef.current) {
              if (allSubmittedAtRef.current === 0) {
                allSubmittedAtRef.current = Date.now();
              }

              const elapsed = Date.now() - allSubmittedAtRef.current;
              const shouldAdvance = isHost || elapsed > ADVANCE_FALLBACK;

              if (shouldAdvance) {
                advancingRef.current = true;
                try {
                  await writeContract(accountRef.current!, "advance_to_voting", [
                    pollRoomCodeRef.current,
                  ]);
                } catch {
                  advancingRef.current = false;
                }
              }
            }
            return;
          }

          // ---- ROUND 2 ----
          if (data.status === "round_2") {
            allSubmittedAtRef.current = 0;

            const humanVotes = humanPlayers.filter((id) => data.votes[id]).length;
            const allVoted = humanVotes === humanPlayers.length;

            if (!data.votes[myAddr]) {
              setScreen("round2");
            } else {
              setScreen("round2_waiting");
            }

            if (allVoted && !calculatingRef.current) {
              if (allVotesAtRef.current === 0) {
                allVotesAtRef.current = Date.now();
              }

              const elapsed = Date.now() - allVotesAtRef.current;
              const shouldCalc = isHost || elapsed > CALC_FALLBACK;

              if (shouldCalc) {
                calculatingRef.current = true;
                try {
                  await writeContract(
                    accountRef.current!,
                    "calculate_results",
                    [pollRoomCodeRef.current]
                  );
                } catch {
                  calculatingRef.current = false;
                }
              }
            }
            return;
          }

          // ---- COMPLETED ----
          if (data.status === "completed") {
            allVotesAtRef.current = 0;
            stopPolling();
            setScreen("results");
          }
        } catch {
          // Network blip - just wait for next poll
        }
      };

      poll();
      pollTimerRef.current = setInterval(poll, POLL_INTERVAL);
    },
    [stopPolling]
  );

  // Clean up polling on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // ---- Helpers ----
  function getAccount() {
    if (!accountRef.current) {
      accountRef.current = makeAccount();
      playerAddressRef.current = accountRef.current.address;
      localStorage.setItem("htp_address", playerAddressRef.current);
    }
    return accountRef.current;
  }

  // ---- Handlers ----
  async function handleCreateRoom(name: string) {
    if (!name.trim()) return;
    setLoading("Creating room...");
    setError("");
    const acc = getAccount();
    localStorage.setItem("htp_name", name);
    setPlayerName(name);
    try {
      const code = await writeContractWithReturn(acc, "create_room", [
        acc.address,
        name,
      ]);
      setRoomCode(code);
      setSubmitted(false);
      setVoted(false);
      advancingRef.current = false;
      calculatingRef.current = false;
      allSubmittedAtRef.current = 0;
      allVotesAtRef.current = 0;
      startPolling(code);
    } catch {
      setError("Failed to create room. Try again.");
    } finally {
      setLoading("");
    }
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
      setSubmitted(false);
      setVoted(false);
      advancingRef.current = false;
      calculatingRef.current = false;
      allSubmittedAtRef.current = 0;
      allVotesAtRef.current = 0;
      startPolling(code.toUpperCase());
    } catch {
      setError("Could not join room. Check the code.");
    } finally {
      setLoading("");
    }
  }

  async function handleSoloArena() {
    const name = playerName || "Player";
    setLoading("Setting up Solo Arena...");
    setError("");
    const acc = getAccount();
    try {
      const code = await writeContractWithReturn(acc, "create_solo_room", [
        acc.address,
        name,
      ]);
      setRoomCode(code);
      setSubmitted(false);
      setVoted(false);
      advancingRef.current = false;
      calculatingRef.current = false;
      allSubmittedAtRef.current = 0;
      allVotesAtRef.current = 0;
      startPolling(code);
    } catch {
      setError("Failed to start Solo Arena. Try again.");
    } finally {
      setLoading("");
    }
  }

  async function handleToggleReady() {
    if (!roomCode) return;
    setLoading("Updating...");
    const acc = getAccount();
    try {
      await writeContract(acc, "toggle_ready", [roomCode, acc.address]);
    } catch {
      // silent - polling will sync
    } finally {
      setLoading("");
    }
  }

  async function handleStartGame() {
    if (!roomCode) return;
    setLoading("Starting game...");
    const acc = getAccount();
    try {
      await writeContract(acc, "start_game", [roomCode, acc.address]);
    } catch {
      setError("Could not start game.");
    } finally {
      setLoading("");
    }
  }

  async function handleSubmitTake(
    scenarioId: number,
    stance: Stance,
    take: string
  ) {
    if (!roomCode) return;
    setLoading("Submitting take...");
    const acc = getAccount();
    try {
      await writeContract(acc, "submit_take", [
        roomCode,
        acc.address,
        scenarioId,
        stance,
        take,
      ]);
      setSubmitted(true);
    } catch {
      setError("Could not submit take.");
    } finally {
      setLoading("");
    }
  }

  async function handleSubmitVotes(votes: Record<string, number>) {
    if (!roomCode) return;
    setLoading("Submitting votes...");
    const acc = getAccount();
    try {
      await writeContract(acc, "submit_votes", [
        roomCode,
        acc.address,
        JSON.stringify(votes),
      ]);
      setVoted(true);
    } catch {
      setError("Could not submit votes.");
    } finally {
      setLoading("");
    }
  }

  function handleRejoin(rejoinedRoom: Room, code: string) {
    setRoom(rejoinedRoom);
    setRoomCode(code);
    setSubmitted(!!rejoinedRoom.submissions[playerAddressRef.current]);
    setVoted(!!rejoinedRoom.votes[playerAddressRef.current]);
    advancingRef.current = false;
    calculatingRef.current = false;
    allSubmittedAtRef.current = 0;
    allVotesAtRef.current = 0;

    if (rejoinedRoom.status === "completed") {
      stopPolling();
      setScreen("results");
    } else {
      startPolling(code);
    }
  }

  function handlePlayAgain() {
    stopPolling();
    setRoom(null);
    setRoomCode("");
    setSubmitted(false);
    setVoted(false);
    setError("");
    setScreen("landing");
  }

  // ---- Derived values ----
  const playerAddress = playerAddressRef.current;
  const isHost = room ? room.host === playerAddress : false;
  const isSolo = room?.is_solo ?? false;

  // ---- Inline form state ----
  const [formName, setFormName] = useState(playerName || "");
  const [joinCode, setJoinCode] = useState("");

  // ---- Render ----
  const renderScreen = () => {
    switch (screen) {
      case "landing":
        return (
          <LandingScreen
            onNavigate={setScreen}
            onSolo={handleSoloArena}
            soloLoading={loading === "Setting up Solo Arena..."}
          />
        );

      case "create":
        return (
          <div className="screen">
            <button className="back-btn" onClick={() => setScreen("landing")}>← Back</button>
            <h2 className="screen-title">Create a Room</h2>
            <p className="screen-sub">You will be the host. Share the room code with friends.</p>
            <label className="field-label">Your name</label>
            <input
              className="text-input"
              type="text"
              placeholder="What should we call you?"
              value={formName}
              onChange={(e) => setFormName(e.target.value.slice(0, 20))}
              maxLength={20}
            />
            <button
              className="btn-primary"
              onClick={() => handleCreateRoom(formName)}
              disabled={!!loading || formName.trim().length < 2}
            >
              {loading ? (
                <span className="btn-loading"><span className="spinner" />Creating...</span>
              ) : "Create Room"}
            </button>
            {error && <p className="error-text">{error}</p>}
          </div>
        );

      case "join":
        return (
          <div className="screen">
            <button className="back-btn" onClick={() => setScreen("landing")}>← Back</button>
            <h2 className="screen-title">Join a Room</h2>
            <p className="screen-sub">Enter the 6-character room code from your host.</p>
            <label className="field-label">Room code</label>
            <input
              className="text-input code-input"
              type="text"
              placeholder="e.g. ABX42K"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
              maxLength={6}
            />
            <label className="field-label">Your name</label>
            <input
              className="text-input"
              type="text"
              placeholder="What should we call you?"
              value={formName}
              onChange={(e) => setFormName(e.target.value.slice(0, 20))}
              maxLength={20}
            />
            <button
              className="btn-primary"
              onClick={() => handleJoinRoom(joinCode, formName)}
              disabled={!!loading || joinCode.length < 6 || formName.trim().length < 2}
            >
              {loading ? (
                <span className="btn-loading"><span className="spinner" />Joining...</span>
              ) : "Join Room"}
            </button>
            {error && <p className="error-text">{error}</p>}
          </div>
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

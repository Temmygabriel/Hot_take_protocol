"use client";
// Hot Take Protocol - Rejoin or Review Screen
// v1.0 — renamed from "Check Game Status"
// This is where you come to rejoin a live game OR review completed results

import { useState } from "react";
import { Room } from "../types";
import { getRoom } from "../lib/contract";

interface RejoinProps {
  playerAddress: string;
  onRejoin: (room: Room, code: string) => void;
  onBack: () => void;
}

type LookupState = "idle" | "loading" | "found" | "error";

const STATUS_LABELS: Record<string, { label: string; color: string; action: string }> = {
  lobby: { label: "In lobby", color: "#3B82F6", action: "Rejoin Lobby" },
  round_1: { label: "Round 1 — Live", color: "#F97316", action: "Rejoin Game" },
  round_2: { label: "Round 2 — Voting", color: "#A855F7", action: "Rejoin Game" },
  completed: { label: "Game over", color: "#10B981", action: "View Results" },
};

export default function RejoinScreen({ playerAddress, onRejoin, onBack }: RejoinProps) {
  const [code, setCode] = useState("");
  const [state, setState] = useState<LookupState>("idle");
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState("");

  async function handleLookup() {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) {
      setError("Room codes are 6 characters");
      return;
    }

    setState("loading");
    setError("");

    try {
      const data = await getRoom(trimmed);
      if (data.error) {
        setState("error");
        setError("Room not found. Check the code and try again.");
        return;
      }
      setRoom(data);
      setState("found");
    } catch {
      setState("error");
      setError("Could not reach the contract. Check your connection.");
    }
  }

  const statusInfo = room ? STATUS_LABELS[room.status] || STATUS_LABELS["completed"] : null;

  return (
    <div className="screen">
      <button className="back-btn" onClick={onBack}>
        ← Back
      </button>

     <h2 className="screen-title">Check Game Status</h2>
<p className="screen-sub">
  Enter a room code to check a live game, view results, or jump back in.
</p>

      <div className="lookup-form">
        <input
          className="code-input"
          type="text"
          placeholder="Enter room code (e.g. ABX42K)"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
          onKeyDown={(e) => e.key === "Enter" && handleLookup()}
          maxLength={6}
          autoCapitalize="characters"
        />
        <button
          className="btn-primary"
          onClick={handleLookup}
          disabled={state === "loading" || code.trim().length < 6}
        >
          {state === "loading" ? (
            <span className="btn-loading">
              <span className="spinner" />
              Looking up...
            </span>
          ) : (
            "Look Up"
          )}
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {state === "found" && room && statusInfo && (
        <div className="room-result">
          <div className="room-result-header">
            <span className="room-result-code">{room.code}</span>
            <span
              className="room-result-status"
              style={{ color: statusInfo.color }}
            >
              {statusInfo.label}
            </span>
          </div>

          <div className="room-result-players">
            {Object.values(room.players).map((p) => (
              <span
                key={p.address}
                className={`player-chip ${p.address === playerAddress ? "player-chip--me" : ""}`}
              >
                {p.is_bot ? `🤖 ${p.name}` : p.name}
                {p.address === playerAddress && " (you)"}
              </span>
            ))}
          </div>

          {room.status === "completed" && room.rankings.length > 0 && (
            <div className="mini-rankings">
              <div className="mini-rankings-title">Final rankings</div>
              {room.rankings.slice(0, 3).map((r, i) => (
                <div key={r.player} className="mini-rank-row">
                  <span>{["🥇", "🥈", "🥉"][i]}</span>
                  <span className="mini-rank-name">{r.name}</span>
                  <span className="mini-rank-score">{r.total_score} pts</span>
                </div>
              ))}
            </div>
          )}

          <button
            className="btn-primary"
            onClick={() => onRejoin(room, room.code)}
          >
            {statusInfo.action}
          </button>
        </div>
      )}

      <div className="rejoin-tip">
        <strong>Tip:</strong> Results are stored on-chain permanently. You can always come back to check them.
      </div>
    </div>
  );
}

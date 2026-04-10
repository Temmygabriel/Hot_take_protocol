"use client";
// Hot Take Protocol - Round 1 Screen v1.0

import { useState } from "react";
import { Room, Scenario, Stance } from "../types";

interface Round1Props {
  room: Room;
  playerAddress: string;
  onSubmit: (scenarioId: number, stance: Stance, take: string) => void;
  loading: string;
  submitted: boolean;
}

const STANCES: { value: Stance; emoji: string; label: string; desc: string }[] = [
  { value: "genius", emoji: "🔥", label: "Genius", desc: "This is objectively correct" },
  { value: "trash",  emoji: "🗑️", label: "Trash",  desc: "This is objectively wrong" },
  { value: "spicy",  emoji: "😈", label: "Spicy",  desc: "This will cause chaos" },
];

const MAX_CHARS = 200;

export default function Round1Screen({
  room,
  playerAddress,
  onSubmit,
  loading,
  submitted,
}: Round1Props) {
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [stance, setStance] = useState<Stance | null>(null);
  const [take, setTake] = useState("");

  const charsLeft = MAX_CHARS - take.length;
  const canSubmit = selectedScenario && stance && take.trim().length >= 10 && !submitted;

  const playerList = Object.values(room.players).filter((p) => !p.is_bot);
  const submittedCount = Object.keys(room.submissions).filter((id) => !id.startsWith("bot_")).length;
  const waitingCount = playerList.length - submittedCount;

  if (submitted) {
    return (
      <div className="screen screen--centered">
        <div className="submitted-state">
          <div className="submitted-icon">✓</div>
          <h2 className="screen-title">Take submitted!</h2>
          <p className="screen-sub">
            {submittedCount}/{playerList.length} players have submitted
          </p>

          {waitingCount > 0 ? (
            <>
              <div className="waiting-tip">
                <span className="spinner" />
                Waiting for {waitingCount} more player{waitingCount > 1 ? "s" : ""}...
              </div>
              <div className="timer-banner">
                ⏱ Don&apos;t worry if someone&apos;s slow — after 60 seconds the game
                moves to voting automatically, even if not everyone has submitted.
                No one gets left behind.
              </div>
            </>
          ) : (
            <>
              <div className="waiting-tip">
                <span className="spinner" />
                All takes in — advancing to voting...
              </div>
            </>
          )}

          <p className="genlayer-note">
            Once all takes are in, voting begins instantly — no AI wait needed yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="round-header">
        <span className="round-badge">Round 1</span>
        <span className="round-meta">
          {submittedCount}/{playerList.length} submitted · Room {room.code}
        </span>
      </div>

      <h2 className="screen-title">Pick your scenario</h2>
      <p className="screen-sub">Choose one. Write your hottest take. 200 chars max.</p>

      <div className="scenario-list">
        {room.scenarios.map((s) => (
          <button
            key={s.id}
            className={`scenario-card ${selectedScenario?.id === s.id ? "scenario-card--selected" : ""}`}
            onClick={() => setSelectedScenario(s)}
          >
            <div className="scenario-cat">{s.cat.toUpperCase()}</div>
            <div className="scenario-title">{s.title}</div>
            <div className="scenario-prompt">{s.prompt}</div>
          </button>
        ))}
      </div>

      {selectedScenario && (
        <>
          <div className="section-label">Your stance</div>
          <div className="stance-grid">
            {STANCES.map((s) => (
              <button
                key={s.value}
                className={`stance-btn ${stance === s.value ? "stance-btn--selected" : ""}`}
                onClick={() => setStance(s.value)}
                data-stance={s.value}
              >
                <span className="stance-emoji">{s.emoji}</span>
                <span className="stance-label">{s.label}</span>
                <span className="stance-desc">{s.desc}</span>
              </button>
            ))}
          </div>

          <div className="section-label">Your take</div>
          <div className="take-input-wrapper">
            <textarea
              className="take-input"
              placeholder="Write your hot take here. Make it punchy, make it count..."
              value={take}
              onChange={(e) => setTake(e.target.value.slice(0, MAX_CHARS))}
              rows={4}
            />
            <div className={`char-count ${charsLeft < 20 ? "char-count--warning" : ""}`}>
              {charsLeft} left
            </div>
          </div>

          <button
            className="btn-primary"
            onClick={() => stance && onSubmit(selectedScenario.id, stance, take.trim())}
            disabled={!canSubmit || !!loading}
          >
            {loading ? (
              <span className="btn-loading"><span className="spinner" />Submitting...</span>
            ) : "Submit Take 🔥"}
          </button>
        </>
      )}
    </div>
  );
}

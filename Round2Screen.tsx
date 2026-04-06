"use client";
// Hot Take Protocol - Round 2 Voting Screen
// v1.0

import { useState } from "react";
import { Room, Submission } from "../types";

interface Round2Props {
  room: Room;
  playerAddress: string;
  onSubmitVotes: (votes: Record<string, number>) => void;
  loading: string;
  voted: boolean;
}

const STANCE_DISPLAY = {
  genius: { emoji: "🔥", label: "Genius" },
  trash: { emoji: "🗑️", label: "Trash" },
  spicy: { emoji: "😈", label: "Spicy" },
};

const VOTE_OPTIONS = [1, 2, 3];
const VOTE_LABELS: Record<number, string> = {
  1: "Weak",
  2: "Decent",
  3: "Fire",
};

export default function Round2Screen({
  room,
  playerAddress,
  onSubmitVotes,
  loading,
  voted,
}: Round2Props) {
  // Show all takes except your own
  const takesToVote: Submission[] = Object.values(room.submissions).filter(
    (s) => s.player !== playerAddress
  );

  const [votes, setVotes] = useState<Record<string, number>>({});

  const allVoted = takesToVote.every((s) => votes[s.player] !== undefined);
  const votedCount = Object.keys(room.votes).filter((id) => !id.startsWith("bot_")).length;
  const playerCount = Object.values(room.players).filter((p) => !p.is_bot).length;

  if (voted) {
    return (
      <div className="screen screen--centered">
        <div className="submitted-state">
          <div className="submitted-icon">✓</div>
          <h2 className="screen-title">Votes submitted!</h2>
          <p className="screen-sub">
            {votedCount}/{playerCount} players have voted
          </p>
          <div className="waiting-tip">
            <span className="spinner" />
            Waiting for all votes...
          </div>
          <div className="ai-waiting-block">
            <div className="ai-waiting-icon">⚖️</div>
            <p className="ai-waiting-title">AI judges are on standby</p>
            <p className="ai-waiting-sub">
              Once all votes are in, the AI panel evaluates every take.<br />
              This takes 60–90 seconds — the only AI wait in the game.
            </p>
            <div className="ai-tips">
              <span>They score: persuasiveness · creativity · clarity</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="round-header">
        <span className="round-badge round-badge--2">Round 2</span>
        <span className="round-meta">
          {votedCount}/{playerCount} voted · Room {room.code}
        </span>
      </div>

      <h2 className="screen-title">Vote on the takes</h2>
      <p className="screen-sub">
        Rate each take 1–3. You cannot vote on your own.
      </p>

      <div className="takes-list">
        {takesToVote.map((sub) => {
          const sd = STANCE_DISPLAY[sub.stance] || { emoji: "🔥", label: sub.stance };
          const myVote = votes[sub.player];

          return (
            <div
              key={sub.player}
              className={`take-card ${myVote ? "take-card--voted" : ""}`}
            >
              <div className="take-card-header">
                <span className="take-scenario">{sub.scenario_title}</span>
                <span className="take-stance">
                  {sd.emoji} {sd.label}
                </span>
              </div>

              <div className="take-name">
                {sub.is_bot ? `🤖 ${sub.name}` : sub.name}
              </div>

              <p className="take-text">{sub.take}</p>

              <div className="vote-buttons">
                {VOTE_OPTIONS.map((v) => (
                  <button
                    key={v}
                    className={`vote-btn ${myVote === v ? "vote-btn--selected" : ""}`}
                    onClick={() => setVotes((prev) => ({ ...prev, [sub.player]: v }))}
                  >
                    <span className="vote-num">{v}</span>
                    <span className="vote-label">{VOTE_LABELS[v]}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <button
        className="btn-primary"
        onClick={() => onSubmitVotes(votes)}
        disabled={!allVoted || !!loading}
      >
        {loading ? (
          <span className="btn-loading">
            <span className="spinner" />
            Submitting votes...
          </span>
        ) : (
          `Submit Votes (${Object.keys(votes).length}/${takesToVote.length})`
        )}
      </button>

      {!allVoted && (
        <p className="hint-text">
          Vote on all {takesToVote.length} takes to continue
        </p>
      )}
    </div>
  );
}

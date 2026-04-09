"use client";
// Hot Take Protocol - Round 2 Voting Screen v1.0

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
  trash:  { emoji: "🗑️", label: "Trash" },
  spicy:  { emoji: "😈", label: "Spicy" },
};

export default function Round2Screen({
  room,
  playerAddress,
  onSubmitVotes,
  loading,
  voted,
}: Round2Props) {
  const takesToVote: Submission[] = Object.values(room.submissions).filter(
    (s) => s.player !== playerAddress
  );

  // votes = set of player addresses you have voted for
  const [votes, setVotes] = useState<Set<string>>(new Set());

  const toggleVote = (playerAddr: string) => {
    setVotes((prev) => {
      const next = new Set(prev);
      if (next.has(playerAddr)) {
        next.delete(playerAddr);
      } else {
        if (next.size >= 3) return prev; // max 3 votes
        next.add(playerAddr);
      }
      return next;
    });
  };

  // Build votes record: { playerAddress: 1 } for each voted take
  const buildVotesRecord = (): Record<string, number> => {
    const record: Record<string, number> = {};
    votes.forEach((addr) => { record[addr] = 1; });
    return record;
  };

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
            <p className="ai-waiting-title">AI Judges On Standby</p>
            <p className="ai-waiting-sub">
              Once all votes are in, the AI panel evaluates every take.<br />
              This takes 60–90 seconds — the only AI wait in the game.
            </p>
            <div className="ai-tips">They score: persuasiveness · creativity · clarity</div>
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
        Tap up to <strong>3 takes</strong> you think are best. Tap again to unvote.
      </p>

      <div style={{ textAlign: "center", fontSize: "0.85rem", color: votes.size >= 3 ? "#FF3D00" : "#718096", fontWeight: votes.size >= 3 ? 700 : 400 }}>
        {votes.size}/3 votes used
      </div>

      <div className="takes-list">
        {takesToVote.map((sub) => {
          const sd = STANCE_DISPLAY[sub.stance] || { emoji: "🔥", label: sub.stance };
          const isVoted = votes.has(sub.player);
          const maxReached = votes.size >= 3 && !isVoted;

          return (
            <div
              key={sub.player}
              className={`take-card ${isVoted ? "take-card--voted" : ""}`}
              onClick={() => !maxReached && toggleVote(sub.player)}
              style={{ opacity: maxReached ? 0.45 : 1, cursor: maxReached ? "default" : "pointer" }}
            >
              <div className="take-card-header">
                <span className="take-scenario">{sub.scenario_title}</span>
                <span className="take-stance">{sd.emoji} {sd.label}</span>
              </div>
              <div className="take-name">
                {sub.is_bot ? `🤖 ${sub.name}` : sub.name}
              </div>
              <p className="take-text">{sub.take}</p>
              {isVoted && (
                <div className="voted-indicator">✓ Voted — tap to remove</div>
              )}
            </div>
          );
        })}
      </div>

      <button
        className="btn-primary"
        onClick={() => onSubmitVotes(buildVotesRecord())}
        disabled={votes.size === 0 || !!loading}
      >
        {loading ? (
          <span className="btn-loading"><span className="spinner" />Submitting votes...</span>
        ) : `Submit ${votes.size} Vote${votes.size !== 1 ? "s" : ""}`}
      </button>

      {votes.size === 0 && (
        <p className="hint-text">Tap at least 1 take to vote</p>
      )}
    </div>
  );
}

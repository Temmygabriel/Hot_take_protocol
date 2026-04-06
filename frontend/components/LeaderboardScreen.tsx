"use client";
// Hot Take Protocol - Leaderboard + Stats Screen
// v1.0

import { useState, useEffect } from "react";
import { LeaderboardEntry, PlayerStats } from "../types";
import { getGlobalLeaderboard, getPlayerStats } from "../lib/contract";

interface LeaderboardProps {
  playerAddress: string;
  onBack: () => void;
}

export default function LeaderboardScreen({ playerAddress, onBack }: LeaderboardProps) {
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [myStats, setMyStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"global" | "mine">("global");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [lb, stats] = await Promise.all([
          getGlobalLeaderboard(),
          getPlayerStats(playerAddress),
        ]);
        setBoard(lb);
        setMyStats(stats);
      } catch {
        // silent fail - show empty state
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [playerAddress]);

  const RANK_MEDALS = ["🥇", "🥈", "🥉"];

  return (
    <div className="screen">
      <button className="back-btn" onClick={onBack}>
        ← Back
      </button>

      <h2 className="screen-title">Leaderboard</h2>

      <div className="tab-bar">
        <button
          className={`tab-btn ${tab === "global" ? "tab-btn--active" : ""}`}
          onClick={() => setTab("global")}
        >
          Global
        </button>
        <button
          className={`tab-btn ${tab === "mine" ? "tab-btn--active" : ""}`}
          onClick={() => setTab("mine")}
        >
          My Stats
        </button>
      </div>

      {loading ? (
        <div className="loading-state">
          <span className="spinner" />
          <span>Loading from chain...</span>
        </div>
      ) : tab === "global" ? (
        <div className="leaderboard-list">
          {board.length === 0 ? (
            <p className="empty-state">No games played yet. Be the first.</p>
          ) : (
            board.map((entry, i) => {
              const isMe = entry.address === playerAddress;
              const medal = RANK_MEDALS[i] || `#${i + 1}`;

              return (
                <div
                  key={entry.address}
                  className={`lb-row ${isMe ? "lb-row--me" : ""}`}
                >
                  <span className="lb-medal">{medal}</span>
                  <div className="lb-info">
                    <span className="lb-name">
                      {entry.name}
                      {isMe && " (you)"}
                    </span>
                    <span className="lb-meta">
                      {entry.games_played} games · {entry.wins} wins · avg {entry.avg_score} pts
                    </span>
                  </div>
                  <span className="lb-total">{entry.total_score}</span>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="my-stats">
          {!myStats || myStats.games_played === 0 ? (
            <p className="empty-state">You have not played any games yet. Jump in!</p>
          ) : (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-label">Games Played</span>
                  <span className="stat-value">{myStats.games_played}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Total Score</span>
                  <span className="stat-value">{myStats.total_score}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Wins</span>
                  <span className="stat-value">{myStats.wins}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Avg Score</span>
                  <span className="stat-value">
                    {myStats.games_played > 0
                      ? (myStats.total_score / myStats.games_played).toFixed(1)
                      : "0"}
                  </span>
                </div>
              </div>

              {myStats.best_take && (
                <div className="best-take-card">
                  <span className="best-take-label">Your best take</span>
                  <p className="best-take-text">&ldquo;{myStats.best_take}&rdquo;</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

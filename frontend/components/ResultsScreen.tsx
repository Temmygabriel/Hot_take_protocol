"use client";
// Hot Take Protocol - Results Screen v1.0

import { Room, RankEntry } from "../types";

interface ResultsProps {
  room: Room;
  playerAddress: string;
  onPlayAgain: () => void;
  onHome: () => void;
}

const STANCE_EMOJI: Record<string, string> = {
  genius: "🔥",
  trash:  "🗑️",
  spicy:  "😈",
};

const RANK_MEDALS = ["🥇", "🥈", "🥉"];

export default function ResultsScreen({
  room,
  playerAddress,
  onPlayAgain,
  onHome,
}: ResultsProps) {
  const rankings = room.rankings;
  const myRank = rankings.findIndex((r) => r.player === playerAddress);
  const myResult = rankings[myRank];
  const winner = rankings[0];
  const isWinner = winner?.player === playerAddress;

  return (
    <div className="screen fadeIn">
      {/* Winner Banner */}
      <div className={`winner-banner ${isWinner ? "winner-banner--mine" : ""}`}>
        <div className="winner-crown">
          {isWinner ? "👑 You won!" : `👑 ${winner?.name} wins!`}
        </div>
        {winner && (
          <div className="winner-take">
            <span className="winner-take-label">Winning take:</span>
            <span className="winner-take-text">
              {STANCE_EMOJI[winner.stance]} {winner.take}
            </span>
          </div>
        )}
        {winner?.reason && (
          <div className="winner-reason">AI says: &ldquo;{winner.reason}&rdquo;</div>
        )}
      </div>

      {/* My Result (if not winner) */}
      {!isWinner && myResult && (
        <div className="my-result">
          <span className="my-rank-label">Your rank</span>
          <span className="my-rank-num">#{myRank + 1}</span>
          <span className="my-score">{myResult.total_score} pts</span>
        </div>
      )}

      {/* Full Rankings */}
      <div className="section-label">Full Rankings</div>
      <div className="rankings-list">
        {rankings.map((entry, i) => {
          const isMe = entry.player === playerAddress;
          const medal = RANK_MEDALS[i] || `#${i + 1}`;
          return (
            <div key={entry.player} className={`rank-row ${isMe ? "rank-row--me" : ""}`}>
              <span className="rank-medal">{medal}</span>
              <div className="rank-info">
                <div className="rank-name">
                  {entry.player.startsWith("bot_") ? `🤖 ${entry.name}` : entry.name}
                  {isMe && " (you)"}
                </div>
                <div className="rank-take-preview">
                  {STANCE_EMOJI[entry.stance]} {entry.scenario_title} · &ldquo;{entry.take.slice(0, 60)}{entry.take.length > 60 ? "..." : ""}&rdquo;
                </div>
                {entry.reason && (
                  <div className="rank-reason">⚖️ {entry.reason}</div>
                )}
              </div>
              <div className="rank-scores">
                <div className="rank-total">{entry.total_score}</div>
                <div className="rank-breakdown">
                  <span title="AI score">⚖️ {entry.ai_score}</span>
                  <span title="Vote score">👥 {entry.vote_score}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Score legend */}
      <div className="score-legend">
        <span>⚖️ AI judge score (1–10)</span>
        <span>·</span>
        <span>👥 Peer vote score</span>
        <span>·</span>
        <span>Total = combined</span>
      </div>

      {/* Actions */}
      <div className="results-actions">
        <button className="btn-primary" onClick={onPlayAgain}>Play Again</button>
        <button className="btn-outline" onClick={onHome}>Back to Home</button>
      </div>

      {/* Footer note — updated wording */}
      <p className="results-note">
        Room <strong>{room.code}</strong> · Results are saved on-chain permanently.
        Use <strong>Check Game Status</strong> on the home screen to find this game anytime.
      </p>
    </div>
  );
}

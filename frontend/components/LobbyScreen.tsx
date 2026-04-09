"use client";
// Hot Take Protocol - Lobby Screen v1.0

import { Room } from "../types";

interface LobbyProps {
  room: Room;
  playerAddress: string;
  isHost: boolean;
  onToggleReady: () => void;
  onStartGame: () => void;
  loading: string;
}

export default function LobbyScreen({
  room,
  playerAddress,
  isHost,
  onToggleReady,
  onStartGame,
  loading,
}: LobbyProps) {
  const players = Object.values(room.players);
  const me = room.players[playerAddress];
  const allReady = players.every((p) => p.ready);
  const canStart = isHost && players.length >= 3 && allReady;

  return (
    <div className="screen fadeIn">
      <div className="room-code-banner">
        <span className="rcode-label">Room Code</span>
        <span className="rcode-value">{room.code}</span>
        <button
          className="rcode-copy"
          onClick={() => navigator.clipboard.writeText(room.code)}
        >
          Copy
        </button>
      </div>

      <h2 className="screen-title">Waiting for players</h2>
      <p className="screen-sub">
        {players.length}/5 players · {isHost ? "You are the host" : "Waiting for host to start"}
      </p>

      <div className="player-list">
        {players.map((p) => (
          <div
            key={p.address}
            className={`player-row ${p.address === playerAddress ? "player-row--me" : ""}`}
          >
            <div className="player-avatar">
              {p.name.charAt(0).toUpperCase()}
            </div>
            <span className="player-name">
              {p.name}
              {p.address === playerAddress && " (you)"}
              {p.address === room.host && " 👑"}
            </span>
            <span className={`ready-badge ${p.ready ? "ready-badge--yes" : "ready-badge--no"}`}>
              {p.ready ? "Ready" : "Not ready"}
            </span>
          </div>
        ))}
        {players.length < 5 && (
          <div className="player-row player-row--empty">
            <div className="player-avatar" style={{ background: "#EDF2F7" }}>?</div>
            <span className="player-name" style={{ color: "#A0AEC0" }}>Waiting for player...</span>
          </div>
        )}
      </div>

      <div className="lobby-actions">
        {!isHost && (
          <button
            className={me?.ready ? "btn-ready--ready" : "btn-ready--unready"}
            onClick={onToggleReady}
            disabled={!!loading}
          >
            {loading ? "..." : me?.ready ? "✓ Ready!" : "Mark Ready"}
          </button>
        )}

        {isHost && (
          <button
            className="btn-primary"
            onClick={onStartGame}
            disabled={!canStart || !!loading}
          >
            {loading ? (
              <span className="btn-loading"><span className="spinner" />Starting game...</span>
            ) : `🚀 Start Game (${players.length} players)`}
          </button>
        )}
      </div>

      {isHost && !canStart && (
        <p className="hint-text">
          {players.length < 3
            ? `Need at least 3 players to start (${players.length}/3)`
            : "Waiting for all players to ready up"}
        </p>
      )}

      {!isHost && (
        <p className="hint-text pulse">⏳ Waiting for host to start the game...</p>
      )}
    </div>
  );
}

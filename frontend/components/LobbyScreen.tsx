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
  const isSolo = room.is_solo;
  const allReady = players.every((p) => p.ready);
  const canStart = isHost && players.length >= (isSolo ? 1 : 3) && allReady;

  const copyCode = () => {
    navigator.clipboard.writeText(room.code);
    alert("Room code copied!");
  };

  return (
    <div className="screen fadeIn">
      {/* Header row */}
      <div className="lobby-header">
        <div>
          <div className="lobby-title">{isSolo ? "SOLO ARENA" : "LOBBY"}</div>
          <div className="lobby-meta">
            Room: <strong style={{ letterSpacing: "0.08em" }}>{room.code}</strong>
          </div>
        </div>
        <div className="lobby-header-actions">
          {!isSolo && (
            <button className="btn-outline" onClick={copyCode} style={{ width: "auto", padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
              📋 Copy Code
            </button>
          )}
        </div>
      </div>

      {/* Player list */}
      <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
        Players ({players.length}/5)
      </div>
      <div className="player-list">
        {players.map((p) => (
          <div
            key={p.address}
            className={`player-row ${p.address === playerAddress ? "player-row--me" : ""}`}
          >
            <div className="player-avatar">
              {p.address.startsWith("bot_") ? "🤖" : p.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                {p.name}
                {p.address === room.host && (
                  <span style={{ color: "#FF6D00", marginLeft: "0.4rem", fontSize: "0.78rem" }}>👑 HOST</span>
                )}
                {p.address === playerAddress && (
                  <span style={{ color: "#718096", marginLeft: "0.4rem", fontSize: "0.75rem" }}>(you)</span>
                )}
              </div>
              <div style={{ color: "#A0AEC0", fontSize: "0.75rem" }}>
                {p.address.startsWith("bot_") ? "AI Bot" : p.address.slice(0, 12) + "..."}
              </div>
            </div>
            <span className={`ready-badge ${p.ready ? "ready-badge--yes" : "ready-badge--no"}`}>
              {p.ready ? "✓ READY" : "Waiting..."}
            </span>
          </div>
        ))}
        {players.length < 5 && (
          <div className="player-row player-row--empty">
            <div className="player-avatar">?</div>
            <span style={{ color: "#A0AEC0", fontSize: "0.9rem" }}>Waiting for player...</span>
          </div>
        )}
      </div>

      {/* Ready / Start actions */}
      <div className="lobby-actions">
        {!isHost && !isSolo && (
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
              <span className="btn-loading"><span className="spinner" />Starting...</span>
            ) : (
              `🚀 START GAME`
            )}
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

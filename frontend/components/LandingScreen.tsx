"use client";
import { Screen } from "../types";

interface LandingProps {
  onNavigate: (screen: Screen) => void;
  onSolo: () => void;
  soloLoading: boolean;
}

export default function LandingScreen({ onNavigate, onSolo, soloLoading }: LandingProps) {
  return (
    <div className="landing">
      <div className="landing-hero">
        <div className="landing-badge">🔥 GenLayer Playverse 2026</div>
        <h1 className="landing-title">
          HOT TAKE<br />
          <span className="highlight">PROTOCOL</span>
        </h1>
        <p className="landing-sub">
          Write your hottest take. Let AI be the judge.<br />
          The spiciest argument wins.
        </p>
        <div className="stance-pills">
          <span className="stance-pill">🔥 Genius</span>
          <span className="stance-pill">🗑️ Trash</span>
          <span className="stance-pill">😈 Spicy</span>
        </div>
      </div>

      <div className="landing-actions">
        <button className="btn-primary" onClick={() => onNavigate("create")}>
          Create Room
        </button>
        <button className="btn-secondary" onClick={() => onNavigate("join")}>
          Join Room
        </button>
        <button className="btn-solo" onClick={onSolo} disabled={soloLoading}>
          {soloLoading ? (
            <span className="btn-loading"><span className="spinner" />Setting up arena...</span>
          ) : "⚡ Solo Arena — Play vs AI Bots"}
        </button>
      </div>

      <div className="landing-footer">
        <button className="footer-link" onClick={() => onNavigate("rejoin")}>
          Check Game Status
        </button>
        <span className="footer-divider">·</span>
        <button className="footer-link" onClick={() => onNavigate("leaderboard")}>
          Leaderboard
        </button>
      </div>

      <div className="how-it-works">
        <div className="hiw-step">
          <span className="hiw-num">01</span>
          <span className="hiw-text">Pick a hot take scenario</span>
        </div>
        <div className="hiw-step">
          <span className="hiw-num">02</span>
          <span className="hiw-text">Write your 200-char take</span>
        </div>
        <div className="hiw-step">
          <span className="hiw-num">03</span>
          <span className="hiw-text">Vote on everyone else&apos;s</span>
        </div>
        <div className="hiw-step">
          <span className="hiw-num">04</span>
          <span className="hiw-text">AI judges. Rankings revealed.</span>
        </div>
      </div>
    </div>
  );
}

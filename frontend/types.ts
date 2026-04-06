// Hot Take Protocol - Shared Types
// v1.0

export type Screen =
  | "landing"
  | "create"
  | "join"
  | "lobby"
  | "round1"
  | "round1_waiting"
  | "round2"
  | "round2_waiting"
  | "results"
  | "rejoin"
  | "stats"
  | "leaderboard";

export type Stance = "genius" | "trash" | "spicy";

export interface Scenario {
  id: number;
  cat: string;
  title: string;
  prompt: string;
}

export interface Player {
  name: string;
  address: string;
  ready: boolean;
  score: number;
  ai_score: number;
  vote_score: number;
  is_bot?: boolean;
}

export interface Submission {
  player: string;
  name: string;
  scenario_id: number;
  scenario_title: string;
  scenario_cat: string;
  stance: Stance;
  take: string;
  is_bot?: boolean;
}

export interface RankEntry {
  player: string;
  name: string;
  total_score: number;
  ai_score: number;
  vote_score: number;
  reason: string;
  take: string;
  scenario_title: string;
  stance: Stance;
}

export interface Room {
  code: string;
  host: string;
  status: "lobby" | "round_1" | "round_2" | "completed";
  is_solo: boolean;
  players: Record<string, Player>;
  scenarios: Scenario[];
  submissions: Record<string, Submission>;
  votes: Record<string, Record<string, number>>;
  results: Record<string, unknown>;
  rankings: RankEntry[];
  game_id: number;
  bots_ready?: boolean;
}

export interface PlayerStats {
  games_played: number;
  total_score: number;
  wins: number;
  best_take: string;
  display_name: string;
}

export interface LeaderboardEntry {
  address: string;
  name: string;
  games_played: number;
  total_score: number;
  wins: number;
  avg_score: number;
}

export interface AppState {
  screen: Screen;
  playerAddress: string;
  playerName: string;
  roomCode: string;
  room: Room | null;
  isHost: boolean;
  isSolo: boolean;
  error: string;
  loading: string;
}

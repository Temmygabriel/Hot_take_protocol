// Hot Take Protocol - GenLayer Contract Utils
// v1.0
// All contract calls centralised here

import {
  createClient,
  createAccount,
  TransactionStatus,
  simulator,
} from "genlayer-js";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

// Singleton client
let _client: ReturnType<typeof createClient> | null = null;

export function getClient() {
  if (!_client) {
    _client = createClient({ network: simulator });
  }
  return _client;
}

export function makeAccount() {
  return createAccount();
}

// --------------------------------------------------------------------------
// Write contract - standard (no return value needed)
// --------------------------------------------------------------------------
export async function writeContract(
  account: ReturnType<typeof createAccount>,
  method: string,
  args: unknown[]
): Promise<void> {
  const client = getClient();
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: method,
    args,
    account,
    leaderOnly: false,
  });
  await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    retries: 120,
    interval: 4000,
  });
}

// --------------------------------------------------------------------------
// Write contract with return value (create_room, create_solo_room)
// --------------------------------------------------------------------------
export async function writeContractWithReturn(
  account: ReturnType<typeof createAccount>,
  method: string,
  args: unknown[]
): Promise<string> {
  const client = getClient();

  // Simulate first to get return value
  const simResult = await client.simulateWriteContract({
    address: CONTRACT_ADDRESS,
    functionName: method,
    args,
    account,
    leaderOnly: false,
  });

  // Then actually write
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: method,
    args,
    account,
    leaderOnly: false,
  });

  await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    retries: 120,
    interval: 4000,
  });

  return simResult as string;
}

// --------------------------------------------------------------------------
// Read contract - instant
// --------------------------------------------------------------------------
export async function readContract(
  method: string,
  args: unknown[]
): Promise<string> {
  const client = getClient();
  const result = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: method,
    args,
  });
  return result as string;
}

// --------------------------------------------------------------------------
// Convenience wrappers
// --------------------------------------------------------------------------

export async function getRoom(roomCode: string) {
  const raw = await readContract("get_room", [roomCode]);
  return JSON.parse(raw);
}

export async function getPlayerStats(address: string) {
  const raw = await readContract("get_player_stats", [address]);
  return JSON.parse(raw);
}

export async function getGlobalLeaderboard() {
  const raw = await readContract("get_global_leaderboard", []);
  return JSON.parse(raw);
}

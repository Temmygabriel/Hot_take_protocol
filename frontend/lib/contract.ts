// Hot Take Protocol - GenLayer Contract Utils
// v1.0
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

function makeClient() {
  const account = createAccount();
  const client = createClient({ chain: studionet, account });
  return { client, account };
}

export function makeAccount() {
  return createAccount();
}

export async function writeContract(
  account: ReturnType<typeof createAccount>,
  method: string,
  args: unknown[]
): Promise<void> {
  const { client } = makeClient();
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: method,
    args,
    account,
    leaderOnly: false,
  } as any);
  await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    retries: 120,
    interval: 4000,
  });
}

export async function writeContractWithReturn(
  account: ReturnType<typeof createAccount>,
  method: string,
  args: unknown[]
): Promise<string> {
  const { client } = makeClient();
  const simResult = await client.simulateWriteContract({
    address: CONTRACT_ADDRESS,
    functionName: method,
    args,
  });
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: method,
    args,
    account,
    leaderOnly: false,
  } as any);
  await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    retries: 120,
    interval: 4000,
  });
  return simResult as string;
}

export async function readContract(
  method: string,
  args: unknown[]
): Promise<string> {
  const { client } = makeClient();
  const result = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: method,
    args,
  });
  return result as string;
}

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

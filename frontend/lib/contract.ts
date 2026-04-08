// Hot Take Protocol - GenLayer Contract Utils
// v1.0
// Matches original working single-file pattern exactly

import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
const MAX_ATTEMPTS = 3;

// Mirrors original working page.tsx exactly — fresh client per call, account baked in
function makeClient() {
  const account = createAccount();
  const client = createClient({ chain: studionet, account });
  return { client, account };
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
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { client } = makeClient();
      console.log(`writeContract attempt ${attempt}/${MAX_ATTEMPTS}: ${method}`);
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
      console.log(`writeContract success: ${method}`);
      return;
    } catch (err: any) {
      console.error(`writeContract ${method} attempt ${attempt} failed:`, err?.message, err);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, attempt * 3000));
        continue;
      }
      throw err;
    }
  }
}

// --------------------------------------------------------------------------
// Write contract with return value (create_room, create_solo_room)
// --------------------------------------------------------------------------
export async function writeContractWithReturn(
  account: ReturnType<typeof createAccount>,
  method: string,
  args: unknown[]
): Promise<string> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { client } = makeClient();
      console.log(`writeContractWithReturn attempt ${attempt}/${MAX_ATTEMPTS}: ${method}`);
      const returnValue = await client.simulateWriteContract({
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
      console.log(`writeContractWithReturn success: ${method}, returned:`, returnValue);
      return returnValue as string;
    } catch (err: any) {
      console.error(`writeContractWithReturn ${method} attempt ${attempt} failed:`, err?.message, err);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, attempt * 3000));
        continue;
      }
      throw err;
    }
  }
  throw new Error("All attempts failed");
}

// --------------------------------------------------------------------------
// Read contract - instant view calls
// --------------------------------------------------------------------------
export async function readContract(
  method: string,
  args: unknown[]
): Promise<string> {
  const { client } = makeClient();
  console.log(`readContract: ${method}`);
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

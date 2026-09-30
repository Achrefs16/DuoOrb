import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError, AiWinReward, SubmitAiWinBody } from '../network/apiClient';

/**
 * Hard-AI victory reporting with an offline outbox.
 *
 * Online: the win uploads the moment the game ends and the server's reward
 * (new badges + personalized message) comes back with it — that is the only
 * path that ever shows celebration UI.
 *
 * Offline: the win is appended to a local queue and the game-over screen
 * stays exactly as if no feature existed. No error, no toast, no pending
 * indicator. The queue flushes on the next online game-over (and on profile
 * open); freshly confirmed rewards from a flush celebrate the same way.
 *
 * Failure taxonomy matters here. `ApiError` means the server was reached and
 * said no (bad payload, failed verification): queuing would fail forever, so
 * the win is dropped silently. Anything else is a transport failure: queued.
 */

const QUEUE_KEY = '@duoorb:aiwin-queue:v1';
const QUEUE_CAP = 50;

async function loadQueue(): Promise<SubmitAiWinBody[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SubmitAiWinBody[]) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: SubmitAiWinBody[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-QUEUE_CAP)));
  } catch {
    // Storage failure must never surface as gameplay UI.
  }
}

async function enqueue(payload: SubmitAiWinBody): Promise<void> {
  const queue = await loadQueue();
  if (queue.some((q) => q.clientWinId === payload.clientWinId)) return;
  queue.push(payload);
  await saveQueue(queue);
}

async function dequeue(clientWinId: string): Promise<void> {
  const queue = await loadQueue();
  await saveQueue(queue.filter((q) => q.clientWinId !== clientWinId));
}

/** Number of wins still waiting for a connection. For diagnostics only. */
export async function pendingAiWinCount(): Promise<number> {
  return (await loadQueue()).length;
}

/**
 * Reports one hard-AI win. Returns the server reward on success, null when
 * there is nothing to celebrate (queued offline, or the server refused).
 * Never throws, never shows UI.
 */
export async function reportHardAiWin(payload: SubmitAiWinBody): Promise<AiWinReward | null> {
  try {
    return await api.submitAiWin(payload);
  } catch (e) {
    if (e instanceof ApiError) {
      // Reached the server and refused (verification failed, bad payload):
      // retrying changes nothing, so drop it silently.
      if (__DEV__) console.warn('[aiwin] upload refused:', e.message);
      return null;
    }
    // Transport failure: queue for later, stay silent.
    await enqueue(payload);
    return null;
  }
}

/**
 * Uploads every queued win, oldest first. Returns the successful rewards so
 * the caller can celebrate freshly confirmed badges. Drops server refusals,
 * keeps transport failures queued. Never throws.
 */
export async function flushAiWinQueue(): Promise<AiWinReward[]> {
  const queue = await loadQueue();
  const rewards: AiWinReward[] = [];
  for (const payload of queue) {
    try {
      const reward = await api.submitAiWin(payload);
      rewards.push(reward);
      await dequeue(payload.clientWinId);
    } catch (e) {
      if (e instanceof ApiError) {
        if (__DEV__) console.warn('[aiwin] queued upload refused:', e.message);
        await dequeue(payload.clientWinId);
      }
      // Transport failure: stays queued, try again next time.
    }
  }
  return rewards;
}

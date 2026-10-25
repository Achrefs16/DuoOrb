import { getBestActionAsync } from '@duoorb/game-core';
import type {
  AiWorkerCommand,
  AiWorkerRequest,
  AiWorkerResponse,
} from './aiWorkerProtocol';

/**
 * Web Worker entrypoint for AI turns.
 *
 * The search runs in its own thread, so even a long top-bot think never blocks
 * board input, the clock, or the thinking indicator. Requests are serialized:
 * a newer turn cancels the previous search and starts after the old loop has
 * yielded, which keeps one worker CPU-bound instead of running two searches.
 */
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<AiWorkerCommand>) => void) | null;
  postMessage: (message: AiWorkerResponse) => void;
};

let activeId: number | null = null;
let cancelled = false;
const queue: AiWorkerRequest[] = [];

function pump(): void {
  if (activeId !== null) return;
  const request = queue.shift();
  if (!request) return;

  activeId = request.id;
  cancelled = false;
  void (async () => {
    let response: AiWorkerResponse;
    try {
      const action = await getBestActionAsync(
        request.state,
        request.profile,
        request.seed,
        {
          shouldCancel: () => cancelled,
          budget: request.budget,
        }
      );
      response = { type: 'result', id: request.id, action };
    } catch (error) {
      response = {
        type: 'result',
        id: request.id,
        action: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    activeId = null;
    scope.postMessage(response);
    pump();
  })();
}

scope.onmessage = ({ data }: MessageEvent<AiWorkerCommand>) => {
  if (data.type === 'cancel') {
    if (data.id === activeId) cancelled = true;
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i].id === data.id) queue.splice(i, 1);
    }
    return;
  }
  queue.push(data);
  pump();
};

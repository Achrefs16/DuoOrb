import { getBestActionAsync, botById, type GameAction } from '@duoorb/game-core';
import type {
  AiWorkerCommand,
  AiWorkerRequest,
  AiWorkerResponse,
  HintResponse,
} from './aiWorkerProtocol';

/**
 * Web Worker entrypoint for AI turns and Grandmaster in-game hints.
 *
 * Powered by Pure-Rust WebAssembly (WASM) with AlphaZero ONNX neural network,
 * Universal Mode-Adapter, and Depth-10 Alpha-Beta Tactical Solver.
 * Runs 100% offline in the browser Web Worker with zero server dependency.
 */
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<AiWorkerCommand>) => void) | null;
  postMessage: (message: AiWorkerResponse) => void;
};

let wasmInstance: any = null;
let wasmPromise: Promise<any> | null = null;

async function getWasmEngine(): Promise<any> {
  if (wasmInstance) return wasmInstance;
  if (wasmPromise) return wasmPromise;

  wasmPromise = (async () => {
    try {
      console.log('[WebWorker AI] ⏳ Loading WebAssembly binary and ONNX neural weights...');
      // 1. Fetch and compile WebAssembly binary
      const wasmResp = await fetch('/duoorb_analyzer.wasm');
      const wasmBytes = await wasmResp.arrayBuffer();
      const { instance } = await WebAssembly.instantiate(wasmBytes, {});

      // 2. Fetch and initialize ONNX neural weights
      const onnxResp = await fetch('/models/quoridor_9x9.onnx');
      const onnxBytes = new Uint8Array(await onnxResp.arrayBuffer());

      const { duoorb_ai_malloc, duoorb_ai_init_model_from_bytes, memory } = instance.exports as any;
      const onnxPtr = duoorb_ai_malloc(onnxBytes.length);
      new Uint8Array(memory.buffer).set(onnxBytes, onnxPtr);
      const res = duoorb_ai_init_model_from_bytes(onnxPtr, onnxBytes.length);

      if (res === 0) {
        console.log('[WebWorker AI] ✅ Pure WebAssembly AlphaZero ONNX engine initialized for PWA!');
        wasmInstance = instance;
        return wasmInstance;
      }
      console.warn('[WebWorker AI] Model init returned code:', res);
      return null;
    } catch (err) {
      console.warn('[WebWorker AI] WASM initialization failed, will use heuristic fallback:', err);
      return null;
    }
  })();

  return wasmPromise;
}

function writeStringToWasm(instance: any, str: string): number {
  const enc = new TextEncoder().encode(str + '\0');
  const ptr = instance.exports.duoorb_ai_malloc(enc.length);
  new Uint8Array(instance.exports.memory.buffer).set(enc, ptr);
  return ptr;
}

function readStringFromWasm(instance: any, ptr: number): string | null {
  if (!ptr) return null;
  const mem = new Uint8Array(instance.exports.memory.buffer);
  let end = ptr;
  while (mem[end] !== 0) end++;
  const str = new TextDecoder('utf-8').decode(mem.subarray(ptr, end));
  instance.exports.duoorb_ai_free_string(ptr);
  return str;
}

function runWasmBot(instance: any, state: any, botId?: string, seed?: number): GameAction | null {
  const statePtr = writeStringToWasm(instance, JSON.stringify(state));
  const botPtr = writeStringToWasm(instance, botId || 'achref');
  const seedBig = BigInt((seed ?? 42) >>> 0);
  const resPtr = instance.exports.duoorb_ai_get_bot_action(statePtr, botPtr, seedBig);
  const jsonStr = readStringFromWasm(instance, resPtr);
  if (!jsonStr || jsonStr === 'null') return null;
  return JSON.parse(jsonStr) as GameAction;
}

function runWasmHint(instance: any, state: any): HintResponse | null {
  const statePtr = writeStringToWasm(instance, JSON.stringify(state));
  const resPtr = instance.exports.duoorb_ai_get_hint(statePtr);
  const jsonStr = readStringFromWasm(instance, resPtr);
  if (!jsonStr || jsonStr === 'null') return null;
  return JSON.parse(jsonStr) as HintResponse;
}

function runWasmAnalyze(instance: any, initialState: any, history: any): any {
  const initPtr = writeStringToWasm(instance, JSON.stringify(initialState));
  const histPtr = writeStringToWasm(instance, JSON.stringify(history));
  const resPtr = instance.exports.duoorb_ai_analyze_game(initPtr, histPtr);
  const jsonStr = readStringFromWasm(instance, resPtr);
  if (!jsonStr || jsonStr === '{}' || jsonStr === 'null') return null;
  return JSON.parse(jsonStr);
}

let activeId: number | null = null;
let cancelled = false;
const queue: AiWorkerRequest[] = [];

// Preload WASM engine on worker startup
void getWasmEngine();

function pump(): void {
  if (activeId !== null) return;
  const request = queue.shift();
  if (!request) return;

  activeId = request.id;
  cancelled = false;
  void (async () => {
    let response: AiWorkerResponse;
    try {
      // 1. Match analysis request (WASM AlphaZero + Tactical Solver)
      if (request.type === 'analyze') {
        const wasm = await getWasmEngine();
        if (!wasm) {
          throw new Error('WebAssembly AlphaZero ONNX engine failed to load for analysis');
        }
        const review = runWasmAnalyze(wasm, request.initialState, request.history);
        if (review) {
          console.log(`[WebWorker AI] 📊 Match analysis computed via WASM AlphaZero engine (${review.totalMoves ?? 0} moves)`);
          response = { type: 'result', id: request.id, review, engine: 'wasm-onnx' };
        } else {
          throw new Error('WASM AlphaZero engine returned empty review');
        }
        activeId = null;
        scope.postMessage(response);
        pump();
        return;
      }

      // 2. Classic 2P Search (STRICTLY WASM AlphaZero ONNX — NEVER runs JavaScript)
      const isClassic2P = request.state.mode === '2p';

      if (isClassic2P) {
        const wasm = await getWasmEngine();
        if (!wasm) {
          throw new Error('WebAssembly AlphaZero ONNX engine failed to initialize');
        }

        if (request.isHint) {
          const hint = runWasmHint(wasm, request.state);
          if (hint && hint.bestAction) {
            console.log(`[WebWorker AI] 🧠 Hint generated via WASM AlphaZero ONNX:`, hint.bestAction);
            response = { type: 'result', id: request.id, action: hint.bestAction, hint, engine: 'wasm-onnx' };
            activeId = null;
            scope.postMessage(response);
            pump();
            return;
          }
          throw new Error('WASM AlphaZero engine returned null hint');
        }

        const botPreset = request.botId || (request.profile?.difficulty === 'easy' ? 'martin' : 'achref');
        const action = runWasmBot(wasm, request.state, botPreset, request.seed);
        if (action) {
          console.log(`[WebWorker AI] 🧠 ${botPreset} move generated via WASM AlphaZero ONNX:`, action);
          response = { type: 'result', id: request.id, action, engine: 'wasm-onnx' };
          activeId = null;
          scope.postMessage(response);
          pump();
          return;
        }

        throw new Error(`WASM AlphaZero engine returned null action for ${botPreset}`);
      }

      // 3. Multi-player and variant modes ('4p', 'center2', 'center3', 'race2', 'race3', 'race4')
      // Handcrafted multi-agent heuristic engine in @duoorb/game-core
      const baseProfile =
        request.profile ??
        (request.botId ? botById(request.botId)?.profile : undefined) ??
        botById('achref')!.profile;

      const profile = {
        ...baseProfile,
        engine: 'search' as const,
        depth: Math.min(baseProfile.depth ?? 2, 2),
      };

      const action = await getBestActionAsync(
        request.state,
        profile,
        request.seed,
        {
          shouldCancel: () => cancelled,
          budget: request.budget,
        }
      );

      console.log(
        `[WebWorker AI] 🎲 Multi-agent variant move for ${request.botId ?? 'bot'}:`,
        action
      );

      if (request.isHint && action) {
        response = {
          type: 'result',
          id: request.id,
          action,
          engine: 'js-gamecore',
          hint: {
            bestAction: action,
            winProbability: 0.5,
            tacticalTag: 'Tactical Line',
            explanation: 'Engine-calculated tactical choice.',
            notation: '',
            alternatives: [],
          },
        };
      } else {
        response = { type: 'result', id: request.id, action, engine: 'js-gamecore' };
      }
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

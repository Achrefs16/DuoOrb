import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BotPersonality,
  GameState,
  boardOf,
  routeOf,
} from '@duoorb/game-core';

interface UseBotDialogueOptions {
  personality: BotPersonality | null;
  state: GameState;
  humanIdx: number;
  enabled?: boolean;
}

const MIN_COOLDOWN_MS = 8000;

function pickRandom(lines: string[]): string {
  if (!lines || lines.length === 0) return '';
  const idx = Math.floor(Math.random() * lines.length);
  return lines[idx];
}

export function useBotDialogue({
  personality,
  state,
  humanIdx,
  enabled = true,
}: UseBotDialogueOptions) {
  const [currentText, setCurrentText] = useState<string | null>(null);
  const lastSpokenAt = useRef(0);
  const gameIdRef = useRef<string | null>(null);
  const greetingDoneRef = useRef(false);
  const closeRaceDoneRef = useRef(false);
  const lastHistoryLenRef = useRef(0);
  const gameOverSpokenRef = useRef(false);

  const speak = useCallback((text: string, force = false) => {
    const now = Date.now();
    if (!force && now - lastSpokenAt.current < MIN_COOLDOWN_MS) {
      return;
    }
    lastSpokenAt.current = now;
    setCurrentText(text);
  }, []);

  const dismiss = useCallback(() => {
    setCurrentText(null);
  }, []);

  // Reset tracking on new game
  useEffect(() => {
    if (gameIdRef.current !== state.gameId) {
      gameIdRef.current = state.gameId;
      greetingDoneRef.current = false;
      closeRaceDoneRef.current = false;
      lastHistoryLenRef.current = 0;
      gameOverSpokenRef.current = false;
      setCurrentText(null);

      if (enabled && personality && state.players.length === 2) {
        const timer = setTimeout(() => {
          if (!greetingDoneRef.current && state.status === 'IN_PROGRESS') {
            greetingDoneRef.current = true;
            const line = pickRandom(personality.dialogue.greetings);
            if (line) speak(line, true);
          }
        }, 900);
        return () => clearTimeout(timer);
      }
    }
  }, [state.gameId, enabled, personality, state.status, state.players.length, speak]);

  // Game over dialogue
  useEffect(() => {
    if (!enabled || !personality || state.players.length !== 2) return;
    if (state.status !== 'COMPLETED' || gameOverSpokenRef.current) return;

    gameOverSpokenRef.current = true;
    const humanPlayer = state.players[humanIdx];
    const botPlayer = state.players[1 - humanIdx];
    if (!humanPlayer || !botPlayer) return;

    const timer = setTimeout(() => {
      if (state.winnerId === botPlayer.id) {
        const line = pickRandom(personality.dialogue.win);
        if (line) speak(line, true);
      } else if (state.winnerId === humanPlayer.id) {
        const line = pickRandom(personality.dialogue.lose);
        if (line) speak(line, true);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [state.status, state.winnerId, enabled, personality, humanIdx, state.players, speak]);

  // Mid-game moves and tactical reactions
  useEffect(() => {
    if (!enabled || !personality || state.players.length !== 2) return;
    if (state.status !== 'IN_PROGRESS') return;

    const historyLen = state.history.length;
    if (historyLen <= lastHistoryLenRef.current) return;
    lastHistoryLenRef.current = historyLen;

    const lastAction = state.history[historyLen - 1];
    if (!lastAction) return;

    const human = state.players[humanIdx];
    const bot = state.players[1 - humanIdx];
    if (!human || !bot) return;

    const board = boardOf(state);
    const humanDist = routeOf(state, board, human).distance;
    const botDist = routeOf(state, board, bot).distance;

    // Close race detection (both <= 3 steps)
    if (!closeRaceDoneRef.current && humanDist <= 3 && botDist <= 3 && historyLen > 6) {
      closeRaceDoneRef.current = true;
      const line = pickRandom(personality.dialogue.closeRace);
      if (line) {
        speak(line);
        return;
      }
    }

    // Reaction to human placing a wall that blocked the bot
    if (lastAction.playerId === human.id && lastAction.action.type === 'PLACE_WALL') {
      if (botDist >= 3) {
        const line = pickRandom(personality.dialogue.playerBlock);
        if (line) speak(line);
      }
    }

    // Reaction to bot placing a wall
    if (lastAction.playerId === bot.id && lastAction.action.type === 'PLACE_WALL') {
      if (humanDist >= 3) {
        const line = pickRandom(personality.dialogue.botTrap);
        if (line) speak(line);
      }
    }
  }, [
    state,
    enabled,
    personality,
    humanIdx,
    speak,
  ]);

  return {
    text: currentText,
    dismiss,
    botName: personality?.name,
    botColor: personality?.color,
  };
}

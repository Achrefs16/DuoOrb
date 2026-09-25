import { useEffect, useState, useCallback } from 'react';
import { GameMode } from '@duoorb/game-core';
import { RoomDto } from '@duoorb/protocol';
import { TimeControl } from '../timeControls';
import { socketManager } from './socket';
import { getCurrentUser } from './auth';

interface UseRoomsOptions {
  onGameStarted: (roomId: string, gameId: string) => void;
  initialRoom?: RoomDto | null;
}

export function useRooms({ onGameStarted, initialRoom = null }: UseRoomsOptions) {
  const [activeRoom, setActiveRoom] = useState<RoomDto | null>(initialRoom);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentUser = getCurrentUser();

  const clearError = useCallback(() => setError(null), []);

  const createRoom = useCallback(
    (mode: GameMode, clock: TimeControl, wallsEach = 10): Promise<RoomDto | null> => {
      return new Promise((resolve) => {
        setLoading(true);
        setError(null);
        const socket = socketManager.getSocket();

        socket.emit(
          'room:create',
          {
            mode,
            timeControlMinutes: clock.minutes,
            incrementSeconds: clock.incrementSeconds ?? 0,
            wallsEach,
          },
          (res) => {
            setLoading(false);
            if (res && res.success && res.room) {
              setActiveRoom(res.room);
              resolve(res.room);
            } else {
              setError(res?.error || 'Failed to create room.');
              resolve(null);
            }
          }
        );
      });
    },
    []
  );

  const inviteToRoom = useCallback(
    (roomId: string, toUserId: string): Promise<boolean> =>
      new Promise((resolve) => {
        const socket = socketManager.getSocket();
        socket.emit('room:invite', { roomId, toUserId }, (res) => {
          if (!res?.success) setError(res?.error || 'Could not send room invite.');
          resolve(Boolean(res?.success));
        });
      }),
    []
  );

  const respondToInvite = useCallback(
    (inviteId: string, accept: boolean): Promise<RoomDto | null> =>
      new Promise((resolve) => {
        const socket = socketManager.getSocket();
        socket.emit('room:inviteRespond', { inviteId, accept }, (res) => {
          if (!res?.success) {
            setError(res?.error || 'Could not respond to room invite.');
            resolve(null);
            return;
          }
          if (res.room) {
            setActiveRoom(res.room);
            resolve(res.room);
          } else {
            resolve(null);
          }
        });
      }),
    []
  );

  const joinRoom = useCallback((code: string): Promise<RoomDto | null> => {
    return new Promise((resolve) => {
      setLoading(true);
      setError(null);
      const socket = socketManager.getSocket();

      socket.emit('room:join', { code: code.trim().toUpperCase() }, (res) => {
        setLoading(false);
        if (res && res.success && res.room) {
          setActiveRoom(res.room);
          resolve(res.room);
        } else {
          setError(res?.error || 'Invalid or closed room code.');
          resolve(null);
        }
      });
    });
  }, []);

  const setReady = useCallback(
    (isReady: boolean) => {
      if (!activeRoom) return;
      const socket = socketManager.getSocket();
      socket.emit('room:ready', { roomId: activeRoom.id, isReady });
    },
    [activeRoom]
  );

  const startRoom = useCallback(() => {
    if (!activeRoom) return;
    const socket = socketManager.getSocket();
    socket.emit('room:start', { roomId: activeRoom.id });
  }, [activeRoom]);

  const kickPlayer = useCallback(    (userId: string) => {
      if (!activeRoom) return;
      const socket = socketManager.getSocket();
      socket.emit('room:kick', { roomId: activeRoom.id, userId }, (res) => {
        if (res && !res.success) {
          setError(res.error || 'Could not remove that player.');
        }
      });
    },
    [activeRoom]
  );

  const leaveRoom = useCallback(() => {
    if (!activeRoom) return;
    const socket = socketManager.getSocket();
    socket.emit('room:leave', { roomId: activeRoom.id });
    setActiveRoom(null);
  }, [activeRoom]);

  /**
   * Ask the server for the room's real state. Needed whenever the lobby is
   * (re)opened with a snapshot from before a match — that copy still says
   * everyone is ready, which would let the host start a game that players who
   * are still on the previous board never joined.
   */
  const syncRoom = useCallback((roomId: string) => {
    const socket = socketManager.getSocket();
    socket.emit('room:sync', { roomId }, (res: { success?: boolean; error?: string } | undefined) => {
      // A failure here is not fatal: the snapshot still renders the lobby.
      // The server remains the authority on whether a game can start.
      if (res && !res.success) return;
    });
  }, []);

  useEffect(() => {
    const socket = socketManager.getSocket();

    const handleRoomState = (room: RoomDto) => {
      setActiveRoom(room);
    };

    const handleRoomStarted = (payload: { roomId: string; gameId: string }) => {
      setActiveRoom(null);
      onGameStarted(payload.roomId, payload.gameId);
    };

    const handleKicked = () => {
      setActiveRoom(null);
      setError('You were removed from the room by the host.');
    };

    socket.on('room:state', handleRoomState);
    socket.on('room:started', handleRoomStarted);
    socket.on('room:kicked', handleKicked);

    return () => {
      socket.off('room:state', handleRoomState);
      socket.off('room:started', handleRoomStarted);
      socket.off('room:kicked', handleKicked);
    };
  }, [onGameStarted]);

  // Re-entering the lobby from a finished match hands us a pre-match
  // snapshot, so pull the truth as soon as the hook mounts.
  useEffect(() => {
    if (!initialRoom) return;
    syncRoom(initialRoom.id);
  }, [initialRoom, syncRoom]);

  const isHost = activeRoom ? activeRoom.hostId === currentUser.userId : false;
  const mySlot = activeRoom ? activeRoom.slots.find((s) => s.userId === currentUser.userId) : null;
  const isReady = mySlot?.isReady ?? false;
  // Never offer Start while the room is running a game, whatever the
  // snapshot claims.
  const canStart = Boolean(
    isHost &&
      activeRoom &&
      activeRoom.status === 'WAITING' &&
      activeRoom.slots.every((s) => (s.userId ? s.isReady : false)) &&
      activeRoom.slots.filter((s) => s.userId !== null).length >= 2
  );

  return {
    activeRoom,
    loading,
    error,
    isHost,
    isReady,
    canStart,
    clearError,
    createRoom,
    inviteToRoom,
    respondToInvite,
    joinRoom,
    setReady,
    startRoom,
    kickPlayer,
    leaveRoom,
    syncRoom,
  };
}

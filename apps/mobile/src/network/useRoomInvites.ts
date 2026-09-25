import { useCallback, useEffect, useState } from 'react';
import { RoomDto, RoomInviteDto } from '@duoorb/protocol';
import { socketManager } from './socket';

interface UseRoomInvitesOptions {
  onAccepted: (room: RoomDto) => void;
}

export function useRoomInvites({ onAccepted }: UseRoomInvitesOptions) {
  const [incoming, setIncoming] = useState<RoomInviteDto | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const socket = socketManager.getSocket();
    const onInvite = (invite: RoomInviteDto) => setIncoming(invite);
    const onDeclined = (payload: { inviteId: string; byUserId: string }) => {
      setNotice('Room invite declined.');
      setTimeout(() => setNotice(null), 2500);
    };
    socket.on('room:inviteReceived', onInvite);
    socket.on('room:inviteDeclined', onDeclined);
    return () => {
      socket.off('room:inviteReceived', onInvite);
      socket.off('room:inviteDeclined', onDeclined);
    };
  }, []);

  const respond = useCallback(
    (accept: boolean) =>
      new Promise<RoomDto | null>((resolve) => {
        if (!incoming) {
          resolve(null);
          return;
        }
        const socket = socketManager.getSocket();
        socket.emit('room:inviteRespond', { inviteId: incoming.inviteId, accept }, (res) => {
          setIncoming(null);
          if (res?.success && res.room) {
            onAccepted(res.room);
            resolve(res.room);
          } else {
            resolve(null);
          }
        });
      }),
    [incoming, onAccepted]
  );

  return { incoming, notice, respond };
}

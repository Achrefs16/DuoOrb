import { io } from 'socket.io-client';

const SERVER_URL = 'http://localhost:4000';

async function testOnlineFlow() {
  console.log('--- Testing DuoOrb Online Real-Time Gateway & Flow ---');

  const clientA = io(SERVER_URL, {
    auth: { token: 'dev-user-alice:alice@duoorb.local' },
    query: { userId: 'user-alice' },
    transports: ['websocket'],
  });

  const clientB = io(SERVER_URL, {
    auth: { token: 'dev-user-bob:bob@duoorb.local' },
    query: { userId: 'user-bob' },
    transports: ['websocket'],
  });

  await new Promise<void>((resolve, reject) => {
    let connected = 0;
    const timeout = setTimeout(() => reject(new Error('Connection timed out')), 5000);
    const check = () => {
      connected++;
      if (connected === 2) {
        clearTimeout(timeout);
        console.log('✓ Both Client A (Alice) and Client B (Bob) connected to Socket.IO server');
        resolve();
      }
    };
    clientA.on('connect', check);
    clientB.on('connect', check);
  });

  // TEST 1: Private Room Creation, Joining, Ready, and Start
  console.log('\n--- Test 1: Private Room Lifecycle ---');
  let roomCode = '';
  let roomId = '';

  await new Promise<void>((resolve, reject) => {
    clientA.emit(
      'room:create',
      { mode: '2p', timeControlMinutes: 3, incrementSeconds: 2 },
      (res: any) => {
        if (!res.success) return reject(new Error(res.error || 'Failed to create room'));
        roomCode = res.room.code;
        roomId = res.room.id;
        console.log(`✓ Room created by Alice: Code = ${roomCode}, ID = ${roomId}`);
        resolve();
      }
    );
  });

  await new Promise<void>((resolve, reject) => {
    clientB.emit('room:join', { code: roomCode }, (res: any) => {
      if (!res.success) return reject(new Error(res.error || 'Failed to join room'));
      console.log(`✓ Bob joined room ${roomCode}`);
      resolve();
    });
  });

  // Bob marks ready
  clientB.emit('room:ready', { roomId, isReady: true });
  console.log('✓ Bob marked ready');

  // Alice starts room
  const gameStartPromise = Promise.all([
    new Promise<string>((resolve) => {
      clientA.once('room:started', (payload: any) => {
        console.log(`✓ Alice received room:started with gameId: ${payload.gameId}`);
        resolve(payload.gameId);
      });
    }),
    new Promise<string>((resolve) => {
      clientB.once('room:started', (payload: any) => {
        console.log(`✓ Bob received room:started with gameId: ${payload.gameId}`);
        resolve(payload.gameId);
      });
    }),
  ]);

  clientA.emit('room:start', { roomId });
  const [roomGameId] = await gameStartPromise;

  // Both join game
  const syncPromise = Promise.all([
    new Promise<any>((resolve) => {
      clientA.once('game:sync', (sync: any) => {
        console.log(`✓ Alice synced game state: status = ${sync.state.status}, history = ${sync.state.history.length}`);
        resolve(sync);
      });
      clientA.emit('game:join', { gameId: roomGameId });
    }),
    new Promise<any>((resolve) => {
      clientB.once('game:sync', (sync: any) => {
        console.log(`✓ Bob synced game state: status = ${sync.state.status}, history = ${sync.state.history.length}`);
        resolve(sync);
      });
      clientB.emit('game:join', { gameId: roomGameId });
    }),
  ]);

  const [syncA] = await syncPromise;

  // Move test: Alice (p1) moves
  const movePromise = Promise.all([
    new Promise<void>((resolve) => {
      clientA.once('game:actionAccepted', (recorded: any) => {
        console.log(`✓ Alice received actionAccepted: seq ${recorded.sequence}, type ${recorded.action.type}`);
        resolve();
      });
    }),
    new Promise<void>((resolve) => {
      clientB.once('game:actionAccepted', (recorded: any) => {
        console.log(`✓ Bob received actionAccepted: seq ${recorded.sequence}, type ${recorded.action.type}`);
        resolve();
      });
    }),
  ]);

  clientA.emit('game:action', {
    gameId: roomGameId,
    action: { type: 'MOVE', to: { row: 7, col: 4 } },
    clientTimestamp: Date.now(),
  });

  await movePromise;

  // TEST 2: Matchmaking Queue
  console.log('\n--- Test 2: Ranked 1v1 Matchmaking Queue ---');

  const mmMatchPromise = Promise.all([
    new Promise<string>((resolve) => {
      clientA.once('matchmaking:matched', (payload: any) => {
        console.log(`✓ Alice matched in matchmaking with gameId: ${payload.gameId}`);
        resolve(payload.gameId);
      });
    }),
    new Promise<string>((resolve) => {
      clientB.once('matchmaking:matched', (payload: any) => {
        console.log(`✓ Bob matched in matchmaking with gameId: ${payload.gameId}`);
        resolve(payload.gameId);
      });
    }),
  ]);

  clientA.emit('matchmaking:find', { mode: '2p', timeControlMinutes: 3, incrementSeconds: 2 });
  clientB.emit('matchmaking:find', { mode: '2p', timeControlMinutes: 3, incrementSeconds: 2 });

  const [mmGameId] = await mmMatchPromise;

  // Both join the ranked game
  clientA.emit('game:join', { gameId: mmGameId });
  clientB.emit('game:join', { gameId: mmGameId });

  // Clock tick test
  await new Promise<void>((resolve) => {
    clientA.once('game:clock', (clock: any) => {
      console.log(`✓ Received authoritative game:clock tick: remaining active = ${clock.remainingMs[Object.keys(clock.remainingMs)[0]]}ms`);
      resolve();
    });
  });

  // Resignation test
  const endedPromise = Promise.all([
    new Promise<void>((resolve) => {
      clientA.once('game:ended', (ended: any) => {
        console.log(`✓ Alice received game:ended: winner = ${ended.winnerId}, reason = ${ended.reason}`);
        resolve();
      });
    }),
    new Promise<void>((resolve) => {
      clientB.once('game:ended', (ended: any) => {
        console.log(`✓ Bob received game:ended: winner = ${ended.winnerId}, reason = ${ended.reason}`);
        resolve();
      });
    }),
  ]);

  // Alice resigns
  clientA.emit('game:resign', { gameId: mmGameId });
  await endedPromise;

  clientA.disconnect();
  clientB.disconnect();

  console.log('\n🎉 ALL ONLINE NETWORKING TESTS PASSED SUCCESSFULLY! 🎉\n');
}

testOnlineFlow().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

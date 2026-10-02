import { useEffect, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { socketManager, type ConnectionStatus } from './socket';

export interface Connectivity {
  /** Null = unknown yet (boot): callers must not flash offline UI on null. */
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}

/** Device network state. Null-safe: unknown reads as "don't know yet". */
export function useConnectivity(): Connectivity {
  const [state, setState] = useState<Connectivity>({
    isConnected: null,
    isInternetReachable: null,
  });

  useEffect(() => {
    const sub = NetInfo.addEventListener((s: NetInfoState) => {
      setState({
        isConnected: s.isConnected,
        isInternetReachable: s.isInternetReachable,
      });
    });
    return () => sub();
  }, []);

  return state;
}

/** Live socket connection status. No polling — pure subscription. */
export function useSocketStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>(() => socketManager.getStatus());

  useEffect(() => socketManager.subscribeStatus(setStatus), []);

  return status;
}

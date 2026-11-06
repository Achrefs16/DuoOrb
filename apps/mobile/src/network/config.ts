import { Platform } from 'react-native';

const isDev = typeof __DEV__ !== 'undefined' ? Boolean(__DEV__) : process.env.NODE_ENV !== 'production';

export const SERVER_URL =
  process.env.EXPO_PUBLIC_SERVER_URL ||
  (!isDev
    ? 'https://api.duoorb.com'
    : Platform.OS === 'android'
      ? 'http://10.0.2.2:4000'
      : Platform.OS === 'web' &&
        typeof window !== 'undefined' &&
        window.location?.hostname !== 'localhost' &&
        window.location?.hostname !== '127.0.0.1'
      ? window.location.origin
      : 'http://localhost:4000');

export const API_URL = `${SERVER_URL}/api`;

import { Platform } from 'react-native';

export const SERVER_URL =
  process.env.EXPO_PUBLIC_SERVER_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000');

export const API_URL = `${SERVER_URL}/api`;

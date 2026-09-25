import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { GoTrueClient } from '@supabase/auth-js';

export type { Session, User } from '@supabase/auth-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let cached: GoTrueClient | null = null;

/**
 * Auth-only Supabase client (no postgrest/realtime/storage graph, which
 * Metro cannot resolve in this project). Lazily created so importing this
 * module never throws and the app boots into guest mode unconfigured.
 */
export function getSupabaseAuth(): GoTrueClient {
  if (cached) return cached;
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }
  cached = new GoTrueClient({
    url: `${SUPABASE_URL}/auth/v1`,
    headers: { apikey: SUPABASE_ANON_KEY as string },
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Web completes auth via full-page redirect back to our origin, so the
    // client must parse the session from the returning URL. Native uses
    // PKCE + an explicit code exchange instead (see session.tsx).
    detectSessionInUrl: Platform.OS === 'web',
  });
  return cached;
}

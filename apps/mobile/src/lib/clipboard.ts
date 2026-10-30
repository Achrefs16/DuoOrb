import { Platform } from 'react-native';

/**
 * Robust cross-platform clipboard copy.
 * Handles Native (iOS/Android), modern Web (navigator.clipboard),
 * legacy/insecure Web (document.execCommand), and prompt fallback.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Modern Web navigator.clipboard
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to next method
    }
  }

  // 2. DOM execCommand fallback for web (works on HTTP, localhost, IP addresses)
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      textarea.setAttribute('readonly', '');
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (success) {
        return true;
      }
    } catch {
      // Fall through to next
    }
  }

  // 3. Expo Clipboard (especially for React Native iOS/Android)
  try {
    const Clipboard = await import('expo-clipboard');
    if (Clipboard && typeof Clipboard.setStringAsync === 'function') {
      const result = await Clipboard.setStringAsync(text);
      if (result !== false) {
        return true;
      }
    }
  } catch {
    // Fall through to prompt
  }

  // 4. Prompt dialog fallback if browser restricts clipboard completely
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.prompt === 'function') {
    try {
      window.prompt('Copy moves (Ctrl+C, Enter):', text);
      return true;
    } catch {
      // Failed completely
    }
  }

  return false;
}

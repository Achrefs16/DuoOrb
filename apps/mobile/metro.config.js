const { getDefaultConfig } = require('expo/metro-config');

// Expo SDK 52+ automatically configures Metro for npm-workspace monorepos,
// so keep this file minimal and let the default resolution handle the
// workspace roots.
module.exports = getDefaultConfig(__dirname);

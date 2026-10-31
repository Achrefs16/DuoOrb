#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const MODULE_ANDROID_JNI = path.resolve(ROOT_DIR, '..', '..', 'modules', 'duoorb-ai-native', 'android', 'src', 'main', 'jniLibs');
const MODULE_IOS = path.resolve(ROOT_DIR, '..', '..', 'modules', 'duoorb-ai-native', 'ios');

console.log('[duoorb-ai-mobile] Building native Rust engine for mobile platforms...');

// Target architectures
const ANDROID_TARGETS = [
  { target: 'aarch64-linux-android', abi: 'arm64-v8a' },
  { target: 'armv7-linux-androideabi', abi: 'armeabi-v7a' },
  { target: 'x86_64-linux-android', abi: 'x86_64' }
];

const IOS_TARGETS = [
  'aarch64-apple-ios',
  'aarch64-apple-ios-sim'
];

function checkTool(tool) {
  try {
    execSync(`${tool} --version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// 1. Android Build
if (checkTool('cargo ndk')) {
  if (!process.env.ANDROID_NDK_HOME) {
    const sdkBase =
      process.env.ANDROID_HOME ||
      process.env.ANDROID_SDK_ROOT ||
      (process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk') : '');
    const ndkRoot = sdkBase ? path.join(sdkBase, 'ndk') : '';
    if (ndkRoot && fs.existsSync(ndkRoot)) {
      const versions = fs.readdirSync(ndkRoot).sort();
      if (versions.length > 0) {
        process.env.ANDROID_NDK_HOME = path.join(ndkRoot, versions[versions.length - 1]);
        console.log(`[duoorb-ai-mobile] Auto-detected ANDROID_NDK_HOME=${process.env.ANDROID_NDK_HOME}`);
      }
    }
  }
  let installedTargets = '';
  try {
    installedTargets = execSync('rustup target list --installed', { encoding: 'utf8' });
  } catch {}
  console.log('[duoorb-ai-mobile] cargo-ndk detected. Compiling Android binaries...');
  for (const { target, abi } of ANDROID_TARGETS) {
    if (installedTargets && !installedTargets.includes(target)) {
      console.log(`[duoorb-ai-mobile] Skipping ${target} (rustup target not installed).`);
      continue;
    }
    try {
      console.log(`[duoorb-ai-mobile] Compiling target ${target} (${abi})...`);
      execSync(`cargo ndk --target ${target} --platform 24 build --release`, { cwd: ROOT_DIR, stdio: 'inherit' });
      const src = path.join(ROOT_DIR, 'target', target, 'release', 'libduoorb_analyzer.so');
      const destDir = path.join(MODULE_ANDROID_JNI, abi);
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(src, path.join(destDir, 'libduoorb_analyzer.so'));
      console.log(`[duoorb-ai-mobile] Installed ${abi}/libduoorb_analyzer.so`);
    } catch (e) {
      console.warn(`[duoorb-ai-mobile] Skipping ${target} (NDK toolchain not configured for target):`, e.message);
    }
  }
} else {
  console.log('[duoorb-ai-mobile] Notice: cargo-ndk is not installed on this host (run "cargo install cargo-ndk" to compile for Android).');
}

// 2. iOS Build
if (process.platform === 'darwin') {
  console.log('[duoorb-ai-mobile] macOS detected. Compiling iOS static libraries...');
  for (const target of IOS_TARGETS) {
    try {
      execSync(`cargo build --target ${target} --release`, { cwd: ROOT_DIR, stdio: 'inherit' });
    } catch (e) {
      console.warn(`[duoorb-ai-mobile] Skipping iOS target ${target}:`, e.message);
    }
  }
} else {
  console.log('[duoorb-ai-mobile] Non-macOS host. Skipping Apple iOS targets (Xcode is required for iOS).');
}

console.log('[duoorb-ai-mobile] Mobile build script completed.');
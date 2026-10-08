import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_CONFIG,
  ANALYSIS_ENGINE_VERSION,
  ANALYSIS_VERSION,
  ANALYSIS_PROFILES,
} from '../src/analysis.js';

describe('Analysis Core Contracts & Config', () => {
  it('exposes canonical analysis version and config', () => {
    expect(ANALYSIS_ENGINE_VERSION).toBe('duoorb-rust-mcts-2.0');
    expect(ANALYSIS_VERSION).toBe('analysis-2.0');
    expect(ANALYSIS_CONFIG.winChanceScale).toBe(20);
    expect(ANALYSIS_CONFIG.accuracyScale).toBe(12);
  });

  it('provides analysis profiles for configuration', () => {
    expect(ANALYSIS_PROFILES.fast).toBeDefined();
    expect(ANALYSIS_PROFILES.normal).toBeDefined();
    expect(ANALYSIS_PROFILES.deep).toBeDefined();
  });
});

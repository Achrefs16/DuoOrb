import React, { memo } from 'react';
import { View } from 'react-native';
import Svg, { Ellipse, Path, Rect } from 'react-native-svg';
import type { BoardSkin } from '../theme/boardTheme';

/**
 * Painted wood texture for the walnut skin. Static SVG — no images, no
 * animation, a few dozen nodes total. Grain paths are hand-drawn waves in
 * a 200×200 box, stretched with `slice` so they read as wood at any size
 * without tiling seams.
 */

/** Hand-drawn grain waves (horizontal planks). */
const TABLE_GRAIN = [
  'M0,18 C25,13 48,23 78,18 S150,13 200,19',
  'M0,24 C30,28 60,20 95,25 S165,29 200,23',
  'M0,68 C28,63 55,72 85,67 S160,62 200,68',
  'M0,76 C35,80 70,72 110,77 S170,81 200,75',
  'M0,118 C25,113 50,122 80,117 S155,112 200,118',
  'M0,126 C30,130 65,121 100,127 S170,130 200,124',
  'M0,168 C28,163 52,172 82,167 S158,162 200,168',
  'M0,176 C32,180 68,171 105,177 S172,181 200,175',
];

/** Vertical grain for the oak playing field. */
const OAK_GRAIN = [
  'M28,0 C24,40 32,80 28,120 S24,170 28,200',
  'M64,0 C68,45 60,90 65,135 S69,175 64,200',
  'M104,0 C100,35 108,75 103,115 S99,165 104,200',
  'M142,0 C146,50 138,95 143,140 S147,180 142,200',
  'M178,0 C174,40 182,85 177,125 S173,170 178,200',
];

const TABLE_PLANKS = ['#352213', '#2E1D12', '#382511', '#2B1B10'];
const OAK_PLANKS = ['#D0A166', '#CBA065', '#D0A166', '#C69A5E', '#CBA065'];

function TableWood(): React.JSX.Element {
  return (
    <>
      <Rect x="0" y="0" width="200" height="200" fill="#2E1D12" />
      {TABLE_PLANKS.map((fill, i) => (
        <Rect key={i} x="0" y={i * 50} width="200" height="50" fill={fill} />
      ))}
      {[50, 100, 150].map((y) => (
        <Rect key={y} x="0" y={y - 1.25} width="200" height="2.5" fill="#160C06" />
      ))}
      {TABLE_GRAIN.map((d, i) =>
        i % 2 === 0 ? (
          <Path key={i} d={d} stroke="#1F1209" strokeWidth="1.4" opacity="0.55" fill="none" />
        ) : (
          <Path key={i} d={d} stroke="#6B4426" strokeWidth="1" opacity="0.4" fill="none" />
        )
      )}
      {/* Knot */}
      <Ellipse cx="150" cy="122" rx="9" ry="5.5" fill="none" stroke="#1F1209" strokeWidth="1.6" opacity="0.7" />
      <Ellipse cx="150" cy="122" rx="3.5" ry="2" fill="#1F1209" opacity="0.7" />
      <Ellipse cx="42" cy="72" rx="6" ry="3.5" fill="none" stroke="#1F1209" strokeWidth="1.2" opacity="0.5" />
    </>
  );
}

function OakField(): React.JSX.Element {
  // NOTE: no straight groove lines here — on the playing field a dark
  // straight line inside a gap reads as a placed wall. Texture only: soft
  // plank tones + faint waves, nothing the eye can mistake for a fence.
  return (
    <>
      <Rect x="0" y="0" width="200" height="200" fill="#D0A166" />
      {OAK_PLANKS.map((fill, i) => (
        <Rect key={i} x={i * 40} y="0" width="40" height="200" fill={fill} opacity="0.55" />
      ))}
      {OAK_GRAIN.map((d, i) => (
        <Path
          key={i}
          d={d}
          stroke={i % 2 === 0 ? '#8A5A30' : '#A8743F'}
          strokeWidth="0.8"
          opacity="0.28"
          fill="none"
        />
      ))}
    </>
  );
}

interface BackdropProps {
  texture: NonNullable<BoardSkin['pageTexture']>;
}

/** Full-bleed walnut table backdrop. Parent gives it `StyleSheet.absoluteFill`. */
export const SkinBackdrop: React.FC<BackdropProps> = memo(({ texture }) => (
  <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
    <Svg width="100%" height="100%" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice">
      {texture === 'walnutTable' ? <TableWood /> : null}
    </Svg>
  </View>
));

interface GrainProps {
  /** Exact board pixel size — the grain sits behind the cells. */
  size: number;
}

/**
 * Oak grain woven through the walnut playing field: absolute, behind the
 * cells, pointer-transparent. Cells + grooves read as inlay on real wood.
 */
export const BoardGrain: React.FC<GrainProps> = memo(({ size }) => (
  <View
    pointerEvents="none"
    style={{ position: 'absolute', top: 0, left: 0, width: size, height: size }}
  >
    <Svg width={size} height={size} viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice">
      <OakField />
    </Svg>
  </View>
));

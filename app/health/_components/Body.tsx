/**
 * Body — anatomically-grounded SVG with individual muscle paths.
 * TypeScript port of body.jsx, ready to drop into a Next.js / React 19 app.
 *
 * Coords: 1000-wide viewBox, height 2500 (aspect 0.40). All paths are
 * illustrative anatomy — not medical reference. Tuned for a medium build.
 *
 * Usage:
 *   <Body primary={['quads']} secondary={['calves']} view="front"
 *         size={220} onMuscleClick={(g) => toggle(g)} theme="light" />
 *
 * Highlight colors come from the iOS tint token (--ios-tint); the skin and
 * outline tones are illustration hues that key off the `theme` prop.
 */

'use client';

import * as React from 'react';

export type MuscleGroup =
  | 'chest' | 'back' | 'lats' | 'shoulders' | 'traps'
  | 'biceps' | 'triceps' | 'forearms'
  | 'abs' | 'obliques'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves';

export interface BodyProps {
  primary?: MuscleGroup[];
  secondary?: MuscleGroup[];
  view?: 'front' | 'back';
  size?: number;
  onMuscleClick?: (group: MuscleGroup) => void;
  theme?: 'light' | 'dark';
  /** Visual hint at body type. Female narrows horizontally by 8%. */
  bodyType?: 'male' | 'female';
}

const VIEW_W = 1000;
const VIEW_H = 2500;

// ─── Outline silhouette ───────────────────────────────────────────────────
const OUTLINE = `
  M 500 40 C 410 40 350 110 350 230
  C 350 310 380 350 415 380 L 415 420
  C 360 440 290 480 235 540 C 195 590 165 660 145 740
  L 115 900 C 100 980 100 1060 115 1130
  C 125 1180 140 1230 155 1270 C 165 1300 180 1310 195 1300
  C 205 1295 210 1280 205 1260 C 195 1210 190 1150 200 1080
  C 215 1000 240 920 270 850 L 305 770
  C 325 720 350 680 380 660 C 395 720 400 800 405 870
  C 410 950 410 1030 405 1100 L 405 1180
  C 395 1240 380 1300 365 1380 C 345 1500 330 1640 335 1780
  C 340 1900 360 1990 385 2060 L 385 2310
  C 380 2380 380 2440 390 2470 L 470 2470
  C 475 2440 475 2390 475 2350 L 475 2080
  C 490 2020 500 1950 500 1860 L 500 1180
  C 500 1180 500 1860 500 1860 C 500 1950 510 2020 525 2080
  L 525 2350 C 525 2390 525 2440 530 2470 L 610 2470
  C 620 2440 620 2380 615 2310 L 615 2060
  C 640 1990 660 1900 665 1780 C 670 1640 655 1500 635 1380
  C 620 1300 605 1240 595 1180 L 595 1100
  C 590 1030 590 950 595 870 C 600 800 605 720 620 660
  C 650 680 675 720 695 770 L 730 850
  C 760 920 785 1000 800 1080 C 810 1150 805 1210 795 1260
  C 790 1280 795 1295 805 1300 C 820 1310 835 1300 845 1270
  C 860 1230 875 1180 885 1130 C 900 1060 900 980 885 900
  L 855 740 C 835 660 805 590 765 540
  C 710 480 640 440 585 420 L 585 380
  C 620 350 650 310 650 230 C 650 110 590 40 500 40 Z
`;

interface MusclePath {
  g: MuscleGroup;
  d: string;
}

const MUSCLES_FRONT: MusclePath[] = [
  { g: 'traps', d: 'M 415 380 C 440 395 470 405 500 405 C 530 405 560 395 585 380 L 590 410 C 555 425 530 430 500 430 C 470 430 445 425 410 410 Z' },
  { g: 'chest', d: 'M 410 420 C 360 440 320 470 295 510 C 285 540 285 570 290 600 C 310 615 340 620 380 615 C 420 605 460 580 485 550 L 495 510 L 495 460 C 470 445 440 430 410 420 Z' },
  { g: 'chest', d: 'M 590 420 C 640 440 680 470 705 510 C 715 540 715 570 710 600 C 690 615 660 620 620 615 C 580 605 540 580 515 550 L 505 510 L 505 460 C 530 445 560 430 590 420 Z' },
  { g: 'shoulders', d: 'M 235 540 C 215 555 200 580 195 615 C 195 650 205 685 225 715 C 245 720 270 715 290 705 C 295 670 295 635 290 600 C 280 580 260 560 235 540 Z' },
  { g: 'shoulders', d: 'M 290 600 C 305 575 330 555 360 545 C 380 555 395 575 405 600 C 405 630 395 660 375 685 C 350 690 320 685 295 670 C 290 645 290 620 290 600 Z' },
  { g: 'shoulders', d: 'M 765 540 C 785 555 800 580 805 615 C 805 650 795 685 775 715 C 755 720 730 715 710 705 C 705 670 705 635 710 600 C 720 580 740 560 765 540 Z' },
  { g: 'shoulders', d: 'M 710 600 C 695 575 670 555 640 545 C 620 555 605 575 595 600 C 595 630 605 660 625 685 C 650 690 680 685 705 670 C 710 645 710 620 710 600 Z' },
  { g: 'biceps', d: 'M 195 615 C 175 640 160 680 150 730 C 150 780 160 830 175 870 C 195 875 220 870 240 860 C 245 815 250 775 250 735 C 245 690 235 650 220 615 C 215 615 205 615 195 615 Z' },
  { g: 'biceps', d: 'M 805 615 C 825 640 840 680 850 730 C 850 780 840 830 825 870 C 805 875 780 870 760 860 C 755 815 750 775 750 735 C 755 690 765 650 780 615 C 785 615 795 615 805 615 Z' },
  { g: 'forearms', d: 'M 175 870 C 160 910 145 970 135 1030 C 130 1080 135 1130 145 1170 C 165 1175 195 1170 215 1160 C 220 1110 225 1060 230 1010 C 230 950 230 905 225 870 C 210 875 190 875 175 870 Z' },
  { g: 'forearms', d: 'M 825 870 C 840 910 855 970 865 1030 C 870 1080 865 1130 855 1170 C 835 1175 805 1170 785 1160 C 780 1110 775 1060 770 1010 C 770 950 770 905 775 870 C 790 875 810 875 825 870 Z' },
  { g: 'abs', d: 'M 460 615 C 450 615 442 625 442 640 L 442 695 C 442 710 452 720 465 720 L 495 720 L 495 615 Z' },
  { g: 'abs', d: 'M 540 615 C 550 615 558 625 558 640 L 558 695 C 558 710 548 720 535 720 L 505 720 L 505 615 Z' },
  { g: 'abs', d: 'M 460 730 C 448 730 440 740 440 755 L 440 810 C 440 825 450 835 465 835 L 495 835 L 495 730 Z' },
  { g: 'abs', d: 'M 540 730 C 552 730 560 740 560 755 L 560 810 C 560 825 550 835 535 835 L 505 835 L 505 730 Z' },
  { g: 'abs', d: 'M 460 845 C 448 845 438 855 438 870 L 438 925 C 438 940 450 950 465 950 L 495 950 L 495 845 Z' },
  { g: 'abs', d: 'M 540 845 C 552 845 562 855 562 870 L 562 925 C 562 940 550 950 535 950 L 505 950 L 505 845 Z' },
  { g: 'abs', d: 'M 462 960 C 450 960 442 970 442 985 L 450 1060 C 455 1080 470 1090 488 1090 L 498 1090 L 498 960 Z' },
  { g: 'abs', d: 'M 538 960 C 550 960 558 970 558 985 L 550 1060 C 545 1080 530 1090 512 1090 L 502 1090 L 502 960 Z' },
  { g: 'obliques', d: 'M 405 870 C 395 920 385 970 385 1030 C 385 1075 395 1110 415 1130 C 425 1110 432 1085 435 1060 L 435 950 L 425 870 Z' },
  { g: 'obliques', d: 'M 595 870 C 605 920 615 970 615 1030 C 615 1075 605 1110 585 1130 C 575 1110 568 1085 565 1060 L 565 950 L 575 870 Z' },
  { g: 'quads', d: 'M 405 1280 C 390 1340 380 1420 375 1500 C 370 1600 370 1700 380 1800 C 395 1820 415 1820 430 1810 C 435 1720 440 1620 445 1530 C 445 1430 445 1340 440 1280 C 425 1278 415 1278 405 1280 Z' },
  { g: 'quads', d: 'M 445 1280 C 442 1360 442 1450 445 1540 C 448 1660 452 1780 460 1860 C 470 1875 488 1875 495 1860 C 498 1780 498 1660 498 1540 C 495 1450 490 1360 485 1280 C 470 1278 455 1278 445 1280 Z' },
  { g: 'quads', d: 'M 460 1700 C 455 1750 458 1810 470 1860 C 480 1880 495 1885 500 1880 L 500 1700 Z' },
  { g: 'quads', d: 'M 595 1280 C 610 1340 620 1420 625 1500 C 630 1600 630 1700 620 1800 C 605 1820 585 1820 570 1810 C 565 1720 560 1620 555 1530 C 555 1430 555 1340 560 1280 C 575 1278 585 1278 595 1280 Z' },
  { g: 'quads', d: 'M 555 1280 C 558 1360 558 1450 555 1540 C 552 1660 548 1780 540 1860 C 530 1875 512 1875 505 1860 C 502 1780 502 1660 502 1540 C 505 1450 510 1360 515 1280 C 530 1278 545 1278 555 1280 Z' },
  { g: 'quads', d: 'M 540 1700 C 545 1750 542 1810 530 1860 C 520 1880 505 1885 500 1880 L 500 1700 Z' },
  { g: 'calves', d: 'M 470 2080 C 460 2140 455 2200 460 2260 C 470 2310 485 2330 500 2330 L 500 2080 Z' },
  { g: 'calves', d: 'M 400 2080 C 395 2140 395 2200 405 2250 C 415 2280 430 2290 445 2280 C 455 2230 460 2170 465 2110 C 460 2090 455 2080 450 2080 Z' },
  { g: 'calves', d: 'M 530 2080 C 540 2140 545 2200 540 2260 C 530 2310 515 2330 500 2330 L 500 2080 Z' },
  { g: 'calves', d: 'M 600 2080 C 605 2140 605 2200 595 2250 C 585 2280 570 2290 555 2280 C 545 2230 540 2170 535 2110 C 540 2090 545 2080 550 2080 Z' },
];

const MUSCLES_BACK: MusclePath[] = [
  { g: 'traps', d: 'M 500 380 C 460 385 425 400 410 425 C 405 460 410 495 425 525 C 445 555 470 575 500 580 C 530 575 555 555 575 525 C 590 495 595 460 590 425 C 575 400 540 385 500 380 Z' },
  { g: 'traps', d: 'M 425 525 C 430 575 445 625 470 660 C 485 670 515 670 530 660 C 555 625 570 575 575 525 C 555 555 530 575 500 580 C 470 575 445 555 425 525 Z' },
  { g: 'shoulders', d: 'M 235 540 C 215 555 200 580 195 615 C 195 650 205 685 225 715 C 250 720 280 715 305 700 C 310 660 310 620 305 580 C 290 560 265 545 235 540 Z' },
  { g: 'shoulders', d: 'M 765 540 C 785 555 800 580 805 615 C 805 650 795 685 775 715 C 750 720 720 715 695 700 C 690 660 690 620 695 580 C 710 560 735 545 765 540 Z' },
  { g: 'lats', d: 'M 305 700 C 320 760 340 820 365 870 C 390 910 420 940 455 960 C 470 940 478 910 480 875 L 480 700 C 460 690 440 685 420 685 C 380 685 340 690 305 700 Z' },
  { g: 'lats', d: 'M 695 700 C 680 760 660 820 635 870 C 610 910 580 940 545 960 C 530 940 522 910 520 875 L 520 700 C 540 690 560 685 580 685 C 620 685 660 690 695 700 Z' },
  { g: 'back', d: 'M 470 970 C 460 1010 455 1060 455 1110 C 470 1130 490 1140 500 1140 L 500 970 Z' },
  { g: 'back', d: 'M 530 970 C 540 1010 545 1060 545 1110 C 530 1130 510 1140 500 1140 L 500 970 Z' },
  { g: 'triceps', d: 'M 195 615 C 175 640 160 680 150 730 C 150 780 160 830 175 870 C 195 875 220 870 240 860 C 245 815 250 775 250 735 C 245 690 235 650 220 615 C 215 615 205 615 195 615 Z' },
  { g: 'triceps', d: 'M 805 615 C 825 640 840 680 850 730 C 850 780 840 830 825 870 C 805 875 780 870 760 860 C 755 815 750 775 750 735 C 755 690 765 650 780 615 C 785 615 795 615 805 615 Z' },
  { g: 'forearms', d: 'M 175 870 C 160 910 145 970 135 1030 C 130 1080 135 1130 145 1170 C 165 1175 195 1170 215 1160 C 220 1110 225 1060 230 1010 C 230 950 230 905 225 870 C 210 875 190 875 175 870 Z' },
  { g: 'forearms', d: 'M 825 870 C 840 910 855 970 865 1030 C 870 1080 865 1130 855 1170 C 835 1175 805 1170 785 1160 C 780 1110 775 1060 770 1010 C 770 950 770 905 775 870 C 790 875 810 875 825 870 Z' },
  { g: 'glutes', d: 'M 410 1180 C 395 1220 390 1265 400 1300 C 420 1325 450 1335 480 1330 L 495 1300 L 495 1180 Z' },
  { g: 'glutes', d: 'M 590 1180 C 605 1220 610 1265 600 1300 C 580 1325 550 1335 520 1330 L 505 1300 L 505 1180 Z' },
  { g: 'hamstrings', d: 'M 405 1340 C 390 1400 380 1480 380 1560 C 380 1680 385 1800 405 1880 C 420 1900 440 1900 455 1885 C 460 1800 462 1690 460 1580 C 458 1480 450 1390 440 1340 C 425 1335 415 1335 405 1340 Z' },
  { g: 'hamstrings', d: 'M 460 1340 C 462 1430 465 1530 470 1620 C 478 1740 488 1860 495 1900 C 500 1900 500 1900 500 1900 L 500 1340 Z' },
  { g: 'hamstrings', d: 'M 595 1340 C 610 1400 620 1480 620 1560 C 620 1680 615 1800 595 1880 C 580 1900 560 1900 545 1885 C 540 1800 538 1690 540 1580 C 542 1480 550 1390 560 1340 C 575 1335 585 1335 595 1340 Z' },
  { g: 'hamstrings', d: 'M 540 1340 C 538 1430 535 1530 530 1620 C 522 1740 512 1860 505 1900 C 500 1900 500 1900 500 1900 L 500 1340 Z' },
  { g: 'calves', d: 'M 470 2080 C 460 2140 455 2200 460 2260 C 470 2310 485 2330 500 2330 L 500 2080 Z' },
  { g: 'calves', d: 'M 400 2080 C 395 2140 395 2200 405 2250 C 415 2280 430 2290 445 2280 C 455 2230 460 2170 465 2110 C 460 2090 455 2080 450 2080 Z' },
  { g: 'calves', d: 'M 530 2080 C 540 2140 545 2200 540 2260 C 530 2310 515 2330 500 2330 L 500 2080 Z' },
  { g: 'calves', d: 'M 600 2080 C 605 2140 605 2200 595 2250 C 585 2280 570 2290 555 2280 C 545 2230 540 2170 535 2110 C 540 2090 545 2080 550 2080 Z' },
];

interface HitZone { g: MuscleGroup; pts: string; }

const HIT_ZONES: Record<'front' | 'back', HitZone[]> = {
  front: [
    { g: 'traps',     pts: '410,380 590,380 590,425 500,440 410,425' },
    { g: 'shoulders', pts: '180,540 320,540 320,720 180,720' },
    { g: 'shoulders', pts: '680,540 820,540 820,720 680,720' },
    { g: 'chest',     pts: '290,420 500,420 500,615 290,615' },
    { g: 'chest',     pts: '500,420 710,420 710,615 500,615' },
    { g: 'biceps',    pts: '140,615 250,615 250,870 140,870' },
    { g: 'biceps',    pts: '750,615 860,615 860,870 750,870' },
    { g: 'forearms',  pts: '125,870 230,870 230,1175 125,1175' },
    { g: 'forearms',  pts: '770,870 875,870 875,1175 770,1175' },
    { g: 'abs',       pts: '435,615 565,615 565,1090 435,1090' },
    { g: 'obliques',  pts: '380,860 440,860 440,1130 380,1130' },
    { g: 'obliques',  pts: '560,860 620,860 620,1130 560,1130' },
    { g: 'quads',     pts: '370,1280 500,1280 500,1880 370,1880' },
    { g: 'quads',     pts: '500,1280 630,1280 630,1880 500,1880' },
    { g: 'calves',    pts: '395,2080 500,2080 500,2330 395,2330' },
    { g: 'calves',    pts: '500,2080 605,2080 605,2330 500,2330' },
  ],
  back: [
    { g: 'traps',     pts: '405,380 595,380 595,670 500,690 405,670' },
    { g: 'shoulders', pts: '180,540 320,540 320,720 180,720' },
    { g: 'shoulders', pts: '680,540 820,540 820,720 680,720' },
    { g: 'lats',      pts: '300,690 500,690 500,970 300,970' },
    { g: 'lats',      pts: '500,690 700,690 700,970 500,970' },
    { g: 'back',      pts: '450,970 550,970 550,1140 450,1140' },
    { g: 'triceps',   pts: '140,615 250,615 250,870 140,870' },
    { g: 'triceps',   pts: '750,615 860,615 860,870 750,870' },
    { g: 'forearms',  pts: '125,870 230,870 230,1175 125,1175' },
    { g: 'forearms',  pts: '770,870 875,870 875,1175 770,1175' },
    { g: 'glutes',    pts: '385,1180 500,1180 500,1340 385,1340' },
    { g: 'glutes',    pts: '500,1180 615,1180 615,1340 500,1340' },
    { g: 'hamstrings',pts: '375,1340 500,1340 500,1900 375,1900' },
    { g: 'hamstrings',pts: '500,1340 625,1340 625,1900 500,1900' },
    { g: 'calves',    pts: '395,2080 500,2080 500,2330 395,2330' },
    { g: 'calves',    pts: '500,2080 605,2080 605,2330 500,2330' },
  ],
};

const ptsToPath = (pts: string): string =>
  'M ' + pts.split(' ').map((p) => p.replace(',', ' ')).join(' L ') + ' Z';

// Accessible name for a hit-zone. Paired muscles (left+right halves share the
// same group) are disambiguated by side so screen readers don't announce two
// identical "Shoulders" buttons. Body coordinates are centered on x=500.
function zoneAriaLabel(z: HitZone, all: HitZone[]): string {
  const base = MUSCLE_LABELS[z.g];
  if (all.filter((x) => x.g === z.g).length < 2) return base;
  const xs = z.pts.split(' ').map((p) => Number(p.split(',')[0]));
  const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const side = cx < 490 ? 'left' : cx > 510 ? 'right' : null;
  return side ? `${base} (${side})` : base;
}

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest', back: 'Lower back', lats: 'Lats', shoulders: 'Shoulders',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms',
  abs: 'Abs', obliques: 'Obliques', traps: 'Traps',
  quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves',
};

export function Body({
  primary = [],
  secondary = [],
  view = 'front',
  size = 220,
  onMuscleClick,
  theme = 'light',
  bodyType = 'male',
}: BodyProps) {
  const isP = (g: MuscleGroup) => primary.includes(g);
  const isS = (g: MuscleGroup) => secondary.includes(g);

  const muscles = view === 'back' ? MUSCLES_BACK : MUSCLES_FRONT;
  const zones = HIT_ZONES[view];

  const isDark = theme === 'dark';
  const skin = isDark ? '#2a2622' : '#f1ece2';
  const muscleLine = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(60,40,20,0.18)';
  const outlineCol = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(40,28,18,0.65)';

  // Female: subtle horizontal narrowing
  const groupTransform = bodyType === 'female' ? 'scale(0.92, 1)' : undefined;

  const aspect = VIEW_W / VIEW_H;
  const height = size / aspect;

  // Unique IDs in case multiple Body components are on one page
  const uid = React.useId();
  const vignetteId = `bodyVignette-${uid}`;
  const highlightId = `bodyHighlight-${uid}`;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width={size}
      height={height}
      style={{ display: 'block', userSelect: 'none', overflow: 'visible' }}
      aria-label={`Anatomical body diagram, ${view} view`}
    >
      <defs>
        <radialGradient id={vignetteId} cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor={isDark ? '#3a342c' : '#fbf6ec'} stopOpacity="1" />
          <stop offset="100%" stopColor={skin} stopOpacity="1" />
        </radialGradient>
        <linearGradient id={highlightId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={isDark ? 0.05 : 0.55} />
          <stop offset="40%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <g
        style={{
          transform: groupTransform,
          transformOrigin: 'center',
          transformBox: 'view-box',
        }}
      >
        {/* Base silhouette fill */}
        <path
          d={OUTLINE}
          fill={`url(#${vignetteId})`}
          stroke={outlineCol}
          strokeWidth="5"
          strokeLinejoin="round"
        />

        {/* Top-light highlight */}
        <path d={OUTLINE} fill={`url(#${highlightId})`} stroke="none" />

        {/* Muscle definition */}
        {muscles.map((m, i) => {
          const p = isP(m.g);
          const s = isS(m.g);
          const active = p || s;
          return (
            <path
              key={i}
              d={m.d}
              fill={p ? 'var(--ios-tint, #356FB0)' : s ? 'var(--ios-tint, #356FB0)' : skin}
              fillOpacity={p ? 0.85 : s ? 0.4 : 0.5}
              stroke={active ? 'var(--ios-tint, #356FB0)' : muscleLine}
              strokeWidth={active ? 3 : 1.8}
              strokeOpacity={active ? 0.9 : 0.7}
              style={{ transition: 'fill 220ms ease, fill-opacity 220ms ease, stroke 220ms ease' }}
            />
          );
        })}

        {/* Re-stroke outline so muscles don't bleed past the body */}
        <path d={OUTLINE} fill="none" stroke={outlineCol} strokeWidth="5" strokeLinejoin="round" />

        {/* Hit-zones (invisible, clickable) */}
        {zones.map((z, i) => (
          <path
            key={`hz-${i}`}
            d={ptsToPath(z.pts)}
            fill="rgba(0,0,0,0.001)"
            onClick={
              onMuscleClick
                ? (e) => {
                    e.stopPropagation();
                    onMuscleClick(z.g);
                  }
                : undefined
            }
            style={{ cursor: onMuscleClick ? 'pointer' : 'default' }}
            role={onMuscleClick ? 'button' : undefined}
            aria-label={onMuscleClick ? zoneAriaLabel(z, zones) : undefined}
          />
        ))}
      </g>
    </svg>
  );
}

export default Body;

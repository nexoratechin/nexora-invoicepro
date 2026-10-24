import { describe, expect, it } from 'vitest';

/**
 * WCAG AA contrast, computed rather than eyeballed. Text pairs need 4.5:1;
 * large text and UI edges need 3:1. The tokens live in index.css and theme.ts.
 */
function luminance(hex: string): number {
  const channels = (hex.replace('#', '').match(/../g) ?? []).map((pair) => {
    const value = parseInt(pair, 16) / 255;

    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
}

function contrast(foreground: string, background: string): number {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  const lighter = values[0] ?? 0;
  const darker = values[1] ?? 0;

  return (lighter + 0.05) / (darker + 0.05);
}

const ink = '#0A1B35';
const muted = '#4A5C78';
const blue = '#0066FF';
const blueDark = '#0052CC';
const white = '#FFFFFF';
const mist = '#F8FAFF';
const navy = '#0A1B35';
const cyan = '#00D4FF';

describe('colour contrast', () => {
  const bodyPairs: [string, string, string][] = [
    ['ink on white', ink, white],
    ['ink on mist', ink, mist],
    ['muted on white', muted, white],
    ['muted on mist', muted, mist],
    ['blue link on white', blue, white],
    ['blue link on mist', blue, mist],
    ['white on primary button', white, blue],
    ['white on hover button', white, blueDark],
    ['white on navy', white, navy],
  ];

  it.each(bodyPairs)('%s passes AA for body text', (_label, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it('navy on cyan passes for a badge', () => {
    expect(contrast(navy, cyan)).toBeGreaterThanOrEqual(3);
  });

  it('the muted text is readable but visibly softer than ink', () => {
    expect(contrast(muted, white)).toBeLessThan(contrast(ink, white));
    expect(contrast(muted, white)).toBeGreaterThanOrEqual(4.5);
  });
});

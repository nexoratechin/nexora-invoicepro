export const colors = {
  navy: '#0A1B35',
  navySoft: '#12294A',
  navyDeep: '#050F20',
  blue: '#0066FF',
  cyan: '#00D4FF',
  mist: '#F8FAFF',
  white: '#FFFFFF',
  ink: '#0A1B35',
  inkMuted: '#4A5C78',
  border: 'rgba(10, 27, 53, 0.10)',
  success: '#059669',
  successSoft: '#ECFDF5',
  warning: '#B45309',
  warningSoft: '#FFFBEB',
  danger: '#DC2626',
  dangerSoft: '#FEF2F2',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const type = {
  title: { fontSize: 24, fontWeight: '700' as const, color: colors.ink },
  heading: { fontSize: 17, fontWeight: '600' as const, color: colors.ink },
  body: { fontSize: 14, color: colors.ink },
  muted: { fontSize: 13, color: colors.inkMuted },
  label: { fontSize: 12, fontWeight: '600' as const, color: colors.inkMuted },
  money: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.ink,
    fontVariant: ['tabular-nums'] as const,
  },
} as const;

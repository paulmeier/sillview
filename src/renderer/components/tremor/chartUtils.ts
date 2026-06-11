/** Shared chart palette + axis styling, in the spirit of Tremor's chart theme. */

export const palette = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#f43f5e', // rose
  '#06b6d4', // cyan
  '#6366f1', // indigo
  '#ec4899', // pink
  '#84cc16', // lime
  '#f97316', // orange
];

export function colorAt(index: number): string {
  return palette[index % palette.length];
}

export const axisTick = { fill: '#94a3b8', fontSize: 11 } as const;
export const gridStroke = '#1f2937';

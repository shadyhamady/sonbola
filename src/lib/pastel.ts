const PASTELS = [
  { bg: 'var(--pastel-mint)', deep: 'mint' },
  { bg: 'var(--pastel-lilac)', deep: 'lilac' },
  { bg: 'var(--pastel-sky)', deep: 'sky' },
  { bg: 'var(--pastel-lav)', deep: 'lav' },
  { bg: 'var(--pastel-pink)', deep: 'pink' },
];

export interface Pastel {
  bg: string;
  fg: string;
  deep: string;
}

export function pastelFor(index: number): Pastel {
  const p = PASTELS[((index % PASTELS.length) + PASTELS.length) % PASTELS.length];
  return { bg: p.bg, fg: '#1d1d22', deep: p.deep };
}

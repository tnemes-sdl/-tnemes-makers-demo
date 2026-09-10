export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

export type Country = {
  /** Curated player-facing name, decoupled from Natural Earth's own labelling
   * (e.g. "South Korea", never the source data's "Republic of Korea"). */
  name: string;
  /**
   * ISO 3166-1 alpha-3 code. A click is matched against this, never against a
   * name, because Natural Earth's own name fields don't always agree with the
   * name shown to the player.
   */
  code: string;
  difficulty: Difficulty;
};

/**
 * Hand-curated by general recognisability, not computed from land area or
 * population — see the spec's Decisions (§10). Disjoint across tiers: no
 * country appears on more than one list. Hard excludes anything that renders
 * as a near-invisible sliver at world zoom in the 50m boundary data.
 */
export const COUNTRIES: readonly Country[] = [
  // --- Easy ---
  { name: 'France', code: 'FRA', difficulty: 'easy' },
  { name: 'Germany', code: 'DEU', difficulty: 'easy' },
  { name: 'Italy', code: 'ITA', difficulty: 'easy' },
  { name: 'Spain', code: 'ESP', difficulty: 'easy' },
  { name: 'United Kingdom', code: 'GBR', difficulty: 'easy' },
  { name: 'United States', code: 'USA', difficulty: 'easy' },
  { name: 'Canada', code: 'CAN', difficulty: 'easy' },
  { name: 'Brazil', code: 'BRA', difficulty: 'easy' },
  { name: 'China', code: 'CHN', difficulty: 'easy' },
  { name: 'Japan', code: 'JPN', difficulty: 'easy' },
  { name: 'India', code: 'IND', difficulty: 'easy' },
  { name: 'Australia', code: 'AUS', difficulty: 'easy' },
  { name: 'Russia', code: 'RUS', difficulty: 'easy' },
  { name: 'Mexico', code: 'MEX', difficulty: 'easy' },
  { name: 'Egypt', code: 'EGY', difficulty: 'easy' },
  { name: 'South Africa', code: 'ZAF', difficulty: 'easy' },
  { name: 'South Korea', code: 'KOR', difficulty: 'easy' },
  { name: 'Argentina', code: 'ARG', difficulty: 'easy' },

  // --- Medium ---
  { name: 'Poland', code: 'POL', difficulty: 'medium' },
  { name: 'Sweden', code: 'SWE', difficulty: 'medium' },
  { name: 'Norway', code: 'NOR', difficulty: 'medium' },
  { name: 'Greece', code: 'GRC', difficulty: 'medium' },
  { name: 'Portugal', code: 'PRT', difficulty: 'medium' },
  { name: 'Netherlands', code: 'NLD', difficulty: 'medium' },
  { name: 'Thailand', code: 'THA', difficulty: 'medium' },
  { name: 'Vietnam', code: 'VNM', difficulty: 'medium' },
  { name: 'Indonesia', code: 'IDN', difficulty: 'medium' },
  { name: 'Nigeria', code: 'NGA', difficulty: 'medium' },
  { name: 'Kenya', code: 'KEN', difficulty: 'medium' },
  { name: 'Chile', code: 'CHL', difficulty: 'medium' },
  { name: 'Colombia', code: 'COL', difficulty: 'medium' },
  { name: 'Peru', code: 'PER', difficulty: 'medium' },
  { name: 'New Zealand', code: 'NZL', difficulty: 'medium' },
  { name: 'Ukraine', code: 'UKR', difficulty: 'medium' },
  { name: 'Morocco', code: 'MAR', difficulty: 'medium' },
  { name: 'Iran', code: 'IRN', difficulty: 'medium' },

  // --- Hard ---
  { name: 'Mongolia', code: 'MNG', difficulty: 'hard' },
  { name: 'Kazakhstan', code: 'KAZ', difficulty: 'hard' },
  { name: 'Uruguay', code: 'URY', difficulty: 'hard' },
  { name: 'Paraguay', code: 'PRY', difficulty: 'hard' },
  { name: 'Bolivia', code: 'BOL', difficulty: 'hard' },
  { name: 'Laos', code: 'LAO', difficulty: 'hard' },
  { name: 'Cambodia', code: 'KHM', difficulty: 'hard' },
  { name: 'Sri Lanka', code: 'LKA', difficulty: 'hard' },
  { name: 'Nepal', code: 'NPL', difficulty: 'hard' },
  { name: 'Georgia', code: 'GEO', difficulty: 'hard' },
  { name: 'Armenia', code: 'ARM', difficulty: 'hard' },
  { name: 'Azerbaijan', code: 'AZE', difficulty: 'hard' },
  { name: 'Moldova', code: 'MDA', difficulty: 'hard' },
  { name: 'Slovakia', code: 'SVK', difficulty: 'hard' },
  { name: 'Croatia', code: 'HRV', difficulty: 'hard' },
  { name: 'Namibia', code: 'NAM', difficulty: 'hard' },
  { name: 'Zambia', code: 'ZMB', difficulty: 'hard' },
  { name: 'Madagascar', code: 'MDG', difficulty: 'hard' },
  { name: 'Ghana', code: 'GHA', difficulty: 'hard' },
  { name: 'Senegal', code: 'SEN', difficulty: 'hard' },
] as const;

export const countriesFor = (difficulty: Difficulty): Country[] =>
  COUNTRIES.filter((country) => country.difficulty === difficulty);

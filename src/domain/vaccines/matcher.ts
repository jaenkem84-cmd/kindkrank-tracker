import { VACCINE_PRODUCTS, type VaccineProduct } from './products';

export type VaccineLabelMatch = {
  product: VaccineProduct;
  /** Longer, more specific names score higher. */
  score: number;
};

function fold(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Matches OCR or typed label text against Handelsnamen.
 * A product matches only when every token of its name is present.
 * A shorter name is dropped when a longer matching name contains it
 * (Priorix-Tetra beats Priorix, Prevenar 13 does not match Prevenar 20).
 */
export function matchVaccineLabel(text: string): VaccineLabelMatch[] {
  const folded = fold(text);
  if (!folded) return [];
  const hits = VACCINE_PRODUCTS.flatMap((product) => {
    const name = fold(product.name);
    const tokens = name.split(' ').filter((token) => token.length > 0);
    if (tokens.length === 0 || !tokens.every((token) => folded.includes(token))) return [];
    return [{ product, score: name.length }];
  }).sort((a, b) => b.score - a.score);
  return hits.filter((hit) => {
    const name = fold(hit.product.name);
    return !hits.some((other) => other.score > hit.score && fold(other.product.name).includes(name));
  });
}

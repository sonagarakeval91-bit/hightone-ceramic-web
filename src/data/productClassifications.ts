import { ProductItem, ProductConfigOverride, ProductVariantMode } from '../types';

export const DEFAULT_FACTORY_COLORS: string[] = [
  'White',
  'Ivory',
  'Magenta',
  'Black',
  'Red',
  'Blue',
  'Cobalt Blue',
  'Coffee Brown',
  'Red Brown',
  'Aqua Green',
  'Oasis Green',
  'Mint Green',
  'Walker Yellow',
  'Burgundy'
];

export const DEFAULT_DESIGN_CODES: string[] = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '7',
  '9',
  '21',
  '23',
  '26',
  '31',
  '32'
];

/**
 * Extracts an explicit model/design code embedded in a product name or SKU
 * (e.g. "DF-01", "D-12", "HT-104", "Orbit DF-01") while ignoring specs like "S-Trap" or "20-Inch".
 */
export function extractBuiltInProductCode(name?: string | null): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;

  // Case 1: Product name itself is a pure model/design code (e.g. "DF-01", "D12", "HT 05")
  if (/^[A-Za-z]{1,6}[-_\s]?\d{1,5}[A-Za-z]?$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  // Case 2: Product name contains an explicit hyphenated/underscored code token (e.g. "DF-01 Wall Hung")
  const tokenMatch = trimmed.match(/\b([A-Za-z]{1,5}[-_]\d{1,4}[A-Za-z]?)\b/);
  if (tokenMatch?.[1]) {
    return tokenMatch[1].toUpperCase();
  }

  return null;
}

/**
 * Derives the initial factory default variant mode, piece weight, and design/default codes
 * for any catalog product based on real Thangadh ceramic dispatch standards.
 */
export function getDefaultProductConfig(product: ProductItem): ProductConfigOverride {
  const nameLower = (product.name || '').toLowerCase();
  const catLower = (product.category || '').toLowerCase();
  const builtInCode = (product.defaultCode || '').trim() || extractBuiltInProductCode(product.name);

  let defaultWeightKg = 15.0;
  let baseMode: ProductVariantMode = 'white-only';
  let availableDesignCodes: string[] | undefined;

  // 1. Designer Pieces (Printed / Tabletop / Chorus Sets)
  if (
    nameLower.includes('designer') ||
    nameLower.includes('tabletop designer') ||
    nameLower.includes('premium set') ||
    nameLower.includes('color set') ||
    catLower.includes('table-top') ||
    nameLower.includes('art basin')
  ) {
    defaultWeightKg = 10.0;
    if (nameLower.includes('set')) defaultWeightKg = 18.0;
    if (nameLower.includes('tabletop')) defaultWeightKg = 9.5;
    baseMode = 'design-code';
    availableDesignCodes = [...DEFAULT_DESIGN_CODES];
  } else if (catLower.includes('orissa') || nameLower.includes('20" op') || nameLower.includes('pan')) {
    const isCtPan = nameLower.includes('ct pan') || nameLower.includes('c t pan');
    baseMode = isCtPan ? 'white-only' : 'color-glaze';
    defaultWeightKg = isCtPan ? 12.0 : 13.5;
  } else if (catLower.includes('one-piece') || nameLower.includes('one piece')) {
    defaultWeightKg = 30.0;
  } else if (catLower.includes('wall-hung') || nameLower.includes('wall hung')) {
    defaultWeightKg = 20.0;
  } else if (catLower.includes('floor-mount') || nameLower.includes('anglo') || nameLower.includes('ewc')) {
    defaultWeightKg = 22.0;
  } else if (catLower.includes('urinal') || nameLower.includes('urinal') || nameLower.includes('halfstall')) {
    defaultWeightKg = 16.0;
    if (nameLower.includes('gents')) defaultWeightKg = 18.0;
    if (nameLower.includes('mini')) defaultWeightKg = 14.0;
  } else if (nameLower.includes('trap')) {
    defaultWeightKg = 1.5;
  } else if (nameLower.includes('seat cover') || nameLower.includes('flush tank')) {
    defaultWeightKg = nameLower.includes('tank') ? 3.5 : 2.0;
  } else if (catLower.includes('basin') || nameLower.includes('basin')) {
    defaultWeightKg = 11.0;
  }

  // Explicit sheet/catalog variant mode override
  if (product.variantMode === 'default-code') {
    return {
      productId: product.id,
      variantMode: 'default-code',
      weightKg: product.weightKg || defaultWeightKg,
      ...(builtInCode ? { defaultCode: builtInCode } : {})
    };
  }

  // Products that already carry an explicit SKU/design code (e.g. DF-01) default to Default Code instead of White
  if (builtInCode && baseMode === 'white-only') {
    return {
      productId: product.id,
      variantMode: 'default-code',
      weightKg: product.weightKg || defaultWeightKg,
      defaultCode: builtInCode
    };
  }

  return {
    productId: product.id,
    variantMode: product.variantMode || baseMode,
    weightKg: product.weightKg || defaultWeightKg,
    ...(availableDesignCodes ? { availableDesignCodes } : {}),
    ...(builtInCode ? { defaultCode: builtInCode } : {})
  };
}

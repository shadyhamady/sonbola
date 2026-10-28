// Mirrors `unit_costs` in src-tauri/src/services/catalog.rs. Keep the two in sync.
import type { PayMode, Unit } from '../api/types';

export function weightKg(unit: Unit, qty: number): number | null {
  switch (unit) {
    case 'kg':
    case 'l':
      return qty;
    case 'g':
    case 'ml':
      return qty / 1000;
    default:
      return null;
  }
}

export interface CostingInput {
  batchYield: number;
  payMode: PayMode;
  payRateMilli: number;
  payBasisIngredientId: number | null;
  overheadPerBatchMilli: number;
  recipe: { ingredientId: number; qty: number }[];
}

export interface CostingIngredient {
  id: number;
  unit: Unit;
  avgCostMilli: number;
}

export interface UnitCostEstimate {
  ingredient: number;
  labor: number;
  overhead: number;
  full: number;
}

/** Per-unit cost estimate (milli, rounded) from the current recipe and ingredient average costs. */
export function estimateUnitCosts(input: CostingInput, ingredients: CostingIngredient[]): UnitCostEstimate {
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const y = Math.max(1, input.batchYield || 1);
  const lines = input.recipe
    .map((r) => ({ ...r, ing: byId.get(r.ingredientId) }))
    .filter((r): r is typeof r & { ing: CostingIngredient } => !!r.ing && r.qty > 0);

  const ingredient = Math.round(lines.reduce((s, l) => s + l.qty * l.ing.avgCostMilli, 0) / y);

  let kgPerBatch = 0;
  if (input.payBasisIngredientId != null) {
    const basis = lines.find((l) => l.ingredientId === input.payBasisIngredientId);
    kgPerBatch = basis ? (weightKg(basis.ing.unit, basis.qty) ?? 0) : 0;
  } else {
    kgPerBatch = lines.reduce((s, l) => s + (weightKg(l.ing.unit, l.qty) ?? 0), 0);
  }

  const rate = input.payRateMilli;
  let labor = 0;
  if (input.payMode === 'per_unit') labor = rate;
  else if (input.payMode === 'per_batch') labor = Math.round(rate / y);
  else if (input.payMode === 'per_kg') labor = Math.round((kgPerBatch * rate) / y);

  const overhead = Math.round(input.overheadPerBatchMilli / y);
  return { ingredient, labor, overhead, full: ingredient + labor + overhead };
}

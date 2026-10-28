import { describe, expect, it } from 'vitest';
import { estimateUnitCosts } from './costing';

describe('estimateUnitCosts', () => {
  it('matches the Rust unit_costs formula for per-kg baker pay on full dough weight', () => {
    const costs = estimateUnitCosts(
      {
        batchYield: 20,
        payMode: 'per_kg',
        payRateMilli: 500,
        payBasisIngredientId: null,
        overheadPerBatchMilli: 2000,
        recipe: [{ ingredientId: 1, qty: 2 }],
      },
      [{ id: 1, unit: 'kg', avgCostMilli: 6000 }],
    );
    expect(costs).toEqual({ ingredient: 600, labor: 50, overhead: 100, full: 750 });
  });
});

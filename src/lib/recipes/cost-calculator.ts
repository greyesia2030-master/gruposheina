interface IngredientForCost {
  quantity: number;
  costPerUnit: number;
}

/**
 * Calcula el costo por porción de una receta.
 */
export function calculateCostPerPortion(
  ingredients: IngredientForCost[],
  portionsYield: number
): number {
  if (portionsYield <= 0) return 0;

  const totalCost = ingredients.reduce(
    (sum, ing) => sum + ing.quantity * ing.costPerUnit,
    0
  );

  return Math.round((totalCost / portionsYield) * 100) / 100;
}

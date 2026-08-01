/**
 * Tank id/chart written into the offline draft.
 * After Clear/Reset, never fall back to boot-time seed (would resurrect the tank).
 * Before Clear, seed keeps the draft stable until selectTank restores from IDB.
 */
export function draftTankIdentity(input: {
  selectedTank: { id: string; chart_number: string } | null;
  seedTankTypeId: string | null;
  seedChartNumber: string | null;
  tankCleared: boolean;
}): { tankTypeId: string | null; chartNumber: string | null } {
  if (input.selectedTank) {
    return {
      tankTypeId: input.selectedTank.id,
      chartNumber: input.selectedTank.chart_number,
    };
  }
  if (input.tankCleared) {
    return { tankTypeId: null, chartNumber: null };
  }
  return {
    tankTypeId: input.seedTankTypeId,
    chartNumber: input.seedChartNumber,
  };
}

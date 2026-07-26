/** True when a dip-chart fetch finished after the driver selected a different tank (or cleared). */
export function isStaleTankPointsResponse(
  requestedTankId: string,
  currentSelectedTankId: string | null,
): boolean {
  return currentSelectedTankId !== requestedTankId;
}

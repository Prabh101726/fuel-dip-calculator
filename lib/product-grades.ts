export const PRODUCT_GRADES = [
  "E15 Reg",
  "E10 Reg",
  "P93",
  "P91",
  "PE10",
  "U94",
  "LSD Clear",
  "LSD Dyed",
] as const;

export type ProductGrade = (typeof PRODUCT_GRADES)[number];

export function tankTabLabel(opts: {
  productGrade: string | null | undefined;
  chartNumber: string | null | undefined;
  slotIndex: number;
}): string {
  const product = opts.productGrade?.trim() ?? "";
  if (product !== "") return product;
  if (opts.chartNumber) return `#${opts.chartNumber}`;
  return `Tank ${opts.slotIndex + 1}`;
}

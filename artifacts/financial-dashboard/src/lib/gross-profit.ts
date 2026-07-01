// Lãi gộp cho từng hợp đồng đơn lẻ (theo ý tưởng PM, độc lập với mô hình mô phỏng đầy đủ).
// Tất cả các khoản trừ đều tính trên GIÁ TRỊ HỢP ĐỒNG (phí tư vấn đã nội suy).

export type PackageType = "design" | "supervision"; // Thiết kế | Giám sát
export type ContractClass = 1 | 2; // Loại hợp đồng

export interface GrossProfitInput {
  packageType: PackageType;
  contractClass: ContractClass;
  /** Giá trị hợp đồng = giá trị xây lắp × tỷ lệ phí nội suy (VNĐ) */
  contractValue: number;
  /** Tỷ lệ cắt lại CĐT (hệ số, vd 0.55) */
  kickbackRate: number;
  /** Tỷ lệ chi phí ký hồ sơ (hệ số, vd 0.05) — chỉ áp dụng gói Thiết kế */
  signingRate: number;
  /** Tỷ lệ nhân công thuê ngoài (hệ số) — chỉ áp dụng Thiết kế + Loại 2 */
  outsourceLaborRate: number;
}

export interface GrossProfitBreakdown {
  contractValue: number;
  kickback: number;
  signingCost: number;
  outsourceLabor: number;
  grossProfit: number;
  grossMargin: number; // lãi gộp / giá trị hợp đồng
}

/** Chi phí ký hồ sơ chỉ áp dụng cho gói Thiết kế (gói Giám sát không có). */
export function hasSigningCost(packageType: PackageType): boolean {
  return packageType === "design";
}

/** Nhân công thuê ngoài chỉ áp dụng Thiết kế + Loại 2. */
export function hasOutsourceLabor(packageType: PackageType, contractClass: ContractClass): boolean {
  return packageType === "design" && contractClass === 2;
}

export function computeGrossProfit(input: GrossProfitInput): GrossProfitBreakdown {
  const { packageType, contractClass, contractValue } = input;

  const kickback = contractValue * (input.kickbackRate || 0);
  const signingCost = hasSigningCost(packageType) ? contractValue * (input.signingRate || 0) : 0;
  const outsourceLabor = hasOutsourceLabor(packageType, contractClass)
    ? contractValue * (input.outsourceLaborRate || 0)
    : 0;

  const grossProfit = contractValue - kickback - signingCost - outsourceLabor;
  const grossMargin = contractValue > 0 ? grossProfit / contractValue : 0;

  return { contractValue, kickback, signingCost, outsourceLabor, grossProfit, grossMargin };
}

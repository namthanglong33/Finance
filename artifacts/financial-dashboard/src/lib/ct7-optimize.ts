// Logic Chiến thuật 7 (CT7) — tối ưu thuế TNDN bằng chi phí lao động thuê ngoài (CTV/HĐLĐ).
// Tách dùng chung cho trang "Tối ưu thuế" và trang "Kết quả sau khi tối ưu thuế".

// Cấu hình CT7 lưu RIÊNG cho từng loại hợp đồng (type1/type2)
export const CT7_SLOTS_LS_KEY = "ntl.ct7.config.v3";

// Thuế TNCN lũy tiến 2026 (theo thu nhập tính thuế/tháng)
export const PIT_BRACKETS_2026 = [
  { limit: 10_000_000, rate: 0.05 }, // Bậc 1: đến 10 tr/tháng → 5%
  { limit: 30_000_000, rate: 0.10 }, // Bậc 2: 10–30 tr/tháng  → 10%
  { limit: 60_000_000, rate: 0.20 }, // Bậc 3: 30–60 tr/tháng  → 20%
  { limit: 100_000_000, rate: 0.30 }, // Bậc 4: 60–100 tr/tháng → 30%
  { limit: Infinity, rate: 0.35 }, // Bậc 5: trên 100 tr     → 35%
];

/** Tính thuế TNCN lũy tiến từ thu nhập tính thuế/tháng */
export function calcProgressivePIT(taxableMonthly: number): number {
  if (taxableMonthly <= 0) return 0;
  let tax = 0;
  let prev = 0;
  for (const { limit, rate } of PIT_BRACKETS_2026) {
    const slice = Math.min(taxableMonthly, limit) - prev;
    if (slice <= 0) break;
    tax += slice * rate;
    prev = limit;
    if (taxableMonthly <= limit) break;
  }
  return Math.round(tax);
}

/** Xác định bậc thuế hiện tại của thu nhập tính thuế/tháng */
export function pitBracketLabel(taxableMonthly: number): string {
  for (let i = 0; i < PIT_BRACKETS_2026.length; i++) {
    const { limit } = PIT_BRACKETS_2026[i];
    if (taxableMonthly <= limit) return `Bậc ${i + 1} (${(PIT_BRACKETS_2026[i].rate * 100).toFixed(0)}%)`;
  }
  return `Bậc 5 (35%)`;
}

// Bảo hiểm doanh nghiệp đóng (HĐLĐ): BHXH 17.5% + BHYT 3% + BHTN 1% = 21.5%
export const CT7_EMPLOYER_INS = 0.215;
// Bảo hiểm người lao động đóng: BHXH 8% + BHYT 1.5% + BHTN 1% = 10.5%
export const CT7_EMPLOYEE_INS = 0.105;
// Lương cơ sở đóng BHXH = lương tối thiểu vùng (6 triệu)
export const CT7_MIN_WAGE_BASE = 6_000_000;

export interface Ct7Config {
  contractType: "ctv" | "hdld";
  numStaff: number;
  monthlyGross: number;
  pitThreshold: number;
  excludeInsurance: boolean;
}

// Cấu hình CT7 đầy đủ của MỘT loại hợp đồng (lưu trong localStorage)
export interface Ct7SlotConfig {
  activeContractTab: "ctv" | "hdld";
  pitThreshold: number;
  legitimizePct: number;
  ctvNumStaff: number;
  ctvMonthlyGross: number;
  hdldNumStaff: number;
  hdldMonthlyGross: number;
  hdldExcludeInsurance: boolean;
}

export const DEFAULT_CT7_SLOT: Ct7SlotConfig = {
  activeContractTab: "ctv",
  pitThreshold: 15_000_000,
  legitimizePct: 90,
  ctvNumStaff: 1,
  ctvMonthlyGross: 10_000_000,
  hdldNumStaff: 1,
  hdldMonthlyGross: 10_000_000,
  hdldExcludeInsurance: false,
};

/** Quy đổi slot (CTV + HĐLĐ) thành Ct7Config theo loại HĐ thuê đang chọn. */
function slotToConfig(slot: Ct7SlotConfig): Ct7Config {
  const tab = slot.activeContractTab === "hdld" ? "hdld" : "ctv";
  return {
    contractType: tab,
    numStaff: tab === "ctv" ? slot.ctvNumStaff : slot.hdldNumStaff,
    monthlyGross: tab === "ctv" ? slot.ctvMonthlyGross : slot.hdldMonthlyGross,
    pitThreshold: slot.pitThreshold,
    excludeInsurance: tab === "hdld" ? slot.hdldExcludeInsurance : false,
  };
}

/** Đọc cấu hình CT7 RIÊNG của một loại hợp đồng (type1/type2) từ localStorage.
 *  Trả về null nếu người dùng chưa từng cấu hình (chưa có key). */
export function loadCt7Config(type: "type1" | "type2"): Ct7Config | null {
  try {
    const raw = localStorage.getItem(CT7_SLOTS_LS_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw);
    const slot = all?.[type];
    if (!slot) return null;
    return slotToConfig({ ...DEFAULT_CT7_SLOT, ...slot });
  } catch {
    return null;
  }
}

export interface Ct7Cost {
  /** Tổng chi phí lao động được khấu trừ TNDN/năm (lương gross + BH DN đóng) × số người */
  totalDeductibleAnnual: number;
  /** Chi phí THỰC công ty bỏ ra/năm = TNCN + bảo hiểm (gross salary được hợp thức hóa) */
  section7RealCost: number;
  pitPerMonth: number;
  pitAnnual: number;
}

/** Tính chi phí khấu trừ và chi phí thực của phương án CT7 từ cấu hình. */
export function computeCt7Cost(config: Ct7Config): Ct7Cost {
  const { contractType, numStaff, monthlyGross, pitThreshold, excludeInsurance } = config;

  const taxableIncomeMonthly = Math.max(0, monthlyGross - pitThreshold);
  const pitPerMonth = calcProgressivePIT(taxableIncomeMonthly);
  const pitAnnual = pitPerMonth * 12;

  const employerInsPerMonth = contractType === "hdld" ? CT7_MIN_WAGE_BASE * CT7_EMPLOYER_INS : 0;
  const companyCostPerMonth = monthlyGross + employerInsPerMonth;
  const totalDeductibleAnnual = companyCostPerMonth * 12 * numStaff;

  const tncnAnnual = pitAnnual * numStaff;
  const insuranceAnnual = contractType === "hdld"
    ? (CT7_EMPLOYER_INS + CT7_EMPLOYEE_INS) * CT7_MIN_WAGE_BASE * 12 * numStaff
    : 0;
  const effectiveInsurance = excludeInsurance ? 0 : insuranceAnnual;
  const section7RealCost = tncnAnnual + effectiveInsurance;

  return { totalDeductibleAnnual, section7RealCost, pitPerMonth, pitAnnual };
}

export interface Ct7Base {
  taxableIncome: number;
  corporateTax: number;
  netProfit: number;
}

export interface Ct7Result {
  newTaxableIncome: number;
  newCIT: number;
  ct7CITSaved: number;
  finalNetProfit: number;
  finalNetProfitMonthly: number;
  totalDeductibleAnnual: number;
  section7RealCost: number;
}

/** Áp chi phí CT7 (đã tính sẵn) lên một kết quả hợp đồng gốc. */
export function applyCt7ToBase(
  base: Ct7Base,
  totalDeductibleAnnual: number,
  section7RealCost: number,
  corporateTaxRate: number,
): Ct7Result {
  const newTaxableIncome = Math.max(0, base.taxableIncome - totalDeductibleAnnual);
  const newCIT = newTaxableIncome * corporateTaxRate;
  const ct7CITSaved = Math.max(0, base.corporateTax - newCIT);
  const finalNetProfit = base.netProfit + ct7CITSaved - section7RealCost;
  return {
    newTaxableIncome,
    newCIT,
    ct7CITSaved,
    finalNetProfit,
    finalNetProfitMonthly: finalNetProfit / 12,
    totalDeductibleAnnual,
    section7RealCost,
  };
}

/** Tiện ích: tính CT7 từ cấu hình + kết quả gốc trong một bước. */
export function applyCt7(base: Ct7Base, config: Ct7Config, corporateTaxRate: number): Ct7Result {
  const { totalDeductibleAnnual, section7RealCost } = computeCt7Cost(config);
  return applyCt7ToBase(base, totalDeductibleAnnual, section7RealCost, corporateTaxRate);
}

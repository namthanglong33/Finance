import { Router } from "express";
import type { Request, Response } from "express";
import type {
  FinancialInput,
  FeeRateInput,
  OptimizeInput,
  ContractResult,
  OptimizeContractResult,
  AllocationItem,
  Scenario,
} from "@workspace/api-zod";

const router = Router();

// ─── TT 38/2026/TT-BXD Fee Rate Tables (Phụ lục VIII, hiệu lực 26/6/2026) ───
// Giám sát: Bảng 2.24 (5 loại công trình).
// Thiết kế: Bảng 2.7/2.9/2.11/2.13/2.15 (thiết kế kỹ thuật, theo loại × cấp),
//   tỷ lệ phí gộp = định mức × hệ số BVTC (KT + bản vẽ thi công).
//   Hệ số BVTC = 1.55, riêng Công nghiệp = 1.60 (BVTC = 60% theo Bảng 2.9).
// Đơn vị bảng: % chi phí xây dựng (chưa VAT). Cột chi phí xây dựng (tỷ đồng) tăng dần.
// Nội suy: Nt = Nb − (Nb−Na)/(Ga−Gb)×(Gt−Gb).

const COST_FULL = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 8000, 10000];
const COST_IV6 = [10, 20, 50, 100, 200, 500]; // Cấp IV: dân dụng, công nghiệp
const COST_IV7 = [10, 20, 50, 100, 200, 500, 1000]; // Cấp IV: giao thông, nông nghiệp, hạ tầng

// Ghép [chi phí, tỷ lệ] và chuyển % → hệ số thập phân
function pct(costs: number[], values: number[]): [number, number][] {
  return costs.map((c, i) => [c, values[i] / 100] as [number, number]);
}

export const CONSTRUCTION_TYPES = [
  "Dân dụng", "Công nghiệp", "Giao thông", "Nông nghiệp & môi trường", "Hạ tầng kỹ thuật",
];

// Bảng 2.24 – Chi phí giám sát thi công xây dựng (đơn vị %, đã là tỷ lệ phí cuối)
const SUPERVISION_TABLES: Record<string, [number, number][]> = {
  "Dân dụng": pct(COST_FULL, [3.285, 2.853, 2.435, 1.845, 1.546, 1.188, 0.797, 0.694, 0.620, 0.530, 0.478]),
  "Công nghiệp": pct(COST_FULL, [3.508, 3.137, 2.559, 2.074, 1.604, 1.301, 0.823, 0.716, 0.640, 0.550, 0.493]),
  "Giao thông": pct(COST_FULL, [3.203, 2.700, 2.356, 1.714, 1.272, 1.003, 0.731, 0.636, 0.550, 0.480, 0.438]),
  "Nông nghiệp & môi trường": pct(COST_FULL, [2.598, 2.292, 2.075, 1.545, 1.189, 0.950, 0.631, 0.550, 0.490, 0.420, 0.378]),
  "Hạ tầng kỹ thuật": pct(COST_FULL, [2.566, 2.256, 1.984, 1.461, 1.142, 0.912, 0.584, 0.509, 0.452, 0.390, 0.350]),
};

// Hệ số gộp thiết kế kỹ thuật + bản vẽ thi công (BVTC) theo loại công trình
const DESIGN_BVTC_MULTIPLIER: Record<string, number> = {
  "Dân dụng": 1.55,
  "Công nghiệp": 1.60,
  "Giao thông": 1.55,
  "Nông nghiệp & môi trường": 1.55,
  "Hạ tầng kỹ thuật": 1.55,
};

// Định mức thiết kế kỹ thuật RAW (đơn vị %, CHƯA nhân hệ số BVTC), theo loại × cấp.
const DESIGN_TECH_PCT: Record<string, Record<string, [number, number][]>> = {
  // Bảng 2.7
  "Dân dụng": {
    "Cấp đặc biệt": pct(COST_FULL, [3.22, 2.81, 2.36, 2.15, 1.96, 1.65, 1.36, 1.16, 0.89, 0.68, 0.61]),
    "Cấp I": pct(COST_FULL, [2.93, 2.55, 2.14, 1.94, 1.78, 1.50, 1.22, 1.05, 0.80, 0.61, 0.55]),
    "Cấp II": pct(COST_FULL, [2.67, 2.33, 1.96, 1.77, 1.62, 1.37, 1.11, 0.94, 0.73, 0.55, 0.50]),
    "Cấp III": pct(COST_FULL, [2.36, 2.07, 1.74, 1.57, 1.43, 1.21, 0.98, 0.83, 0.64, 0.48, 0.44]),
    "Cấp IV": pct(COST_IV6, [2.07, 1.81, 1.48, 1.30, 1.06, 0.89]),
  },
  // Bảng 2.9
  "Công nghiệp": {
    "Cấp đặc biệt": pct(COST_FULL, [2.96, 2.73, 2.34, 2.13, 1.92, 1.76, 1.54, 1.30, 0.97, 0.79, 0.70]),
    "Cấp I": pct(COST_FULL, [2.47, 2.27, 1.93, 1.77, 1.60, 1.46, 1.28, 1.09, 0.80, 0.65, 0.58]),
    "Cấp II": pct(COST_FULL, [2.03, 1.86, 1.59, 1.46, 1.32, 1.20, 1.05, 0.90, 0.66, 0.53, 0.48]),
    "Cấp III": pct(COST_FULL, [1.78, 1.65, 1.40, 1.27, 1.17, 1.06, 0.93, 0.79, 0.58, 0.47, 0.42]),
    "Cấp IV": pct(COST_IV6, [1.59, 1.47, 1.24, 1.14, 0.98, 0.83]),
  },
  // Bảng 2.11
  "Giao thông": {
    "Cấp đặc biệt": pct(COST_FULL, [2.05, 1.92, 1.68, 1.50, 1.36, 1.24, 1.08, 0.92, 0.68, 0.51, 0.45]),
    "Cấp I": pct(COST_FULL, [1.44, 1.39, 1.13, 1.05, 0.95, 0.81, 0.68, 0.58, 0.44, 0.34, 0.28]),
    "Cấp II": pct(COST_FULL, [1.19, 1.08, 0.92, 0.84, 0.77, 0.70, 0.60, 0.51, 0.39, 0.29, 0.25]),
    "Cấp III": pct(COST_FULL, [1.05, 0.93, 0.81, 0.74, 0.68, 0.58, 0.48, 0.43, 0.32, 0.25, 0.21]),
    "Cấp IV": pct(COST_IV7, [0.95, 0.87, 0.76, 0.69, 0.59, 0.49, 0.43]),
  },
  // Bảng 2.13
  "Nông nghiệp & môi trường": {
    "Cấp đặc biệt": pct(COST_FULL, [2.98, 2.60, 2.20, 1.98, 1.83, 1.54, 1.30, 1.13, 0.85, 0.66, 0.58]),
    "Cấp I": pct(COST_FULL, [2.70, 2.36, 1.99, 1.78, 1.66, 1.39, 1.17, 1.02, 0.77, 0.59, 0.52]),
    "Cấp II": pct(COST_FULL, [2.48, 2.14, 1.80, 1.61, 1.51, 1.22, 1.05, 0.87, 0.67, 0.49, 0.42]),
    "Cấp III": pct(COST_FULL, [2.20, 1.90, 1.60, 1.43, 1.24, 1.06, 0.90, 0.77, 0.59, 0.43, 0.37]),
    "Cấp IV": pct(COST_IV7, [1.74, 1.52, 1.27, 1.12, 1.01, 0.80, 0.64]),
  },
  // Bảng 2.15
  "Hạ tầng kỹ thuật": {
    "Cấp đặc biệt": pct(COST_FULL, [2.22, 1.94, 1.63, 1.48, 1.36, 1.14, 0.97, 0.83, 0.61, 0.48, 0.43]),
    "Cấp I": pct(COST_FULL, [2.09, 1.83, 1.53, 1.38, 1.28, 1.04, 0.90, 0.75, 0.53, 0.39, 0.33]),
    "Cấp II": pct(COST_FULL, [1.86, 1.62, 1.36, 1.22, 1.13, 0.91, 0.78, 0.66, 0.47, 0.34, 0.29]),
    "Cấp III": pct(COST_FULL, [1.62, 1.39, 1.19, 1.07, 0.97, 0.80, 0.70, 0.56, 0.41, 0.29, 0.25]),
    "Cấp IV": pct(COST_IV7, [1.45, 1.23, 1.01, 0.92, 0.80, 0.70, 0.58]),
  },
};

// Định mức thiết kế BẢN VẼ THI CÔNG (Bảng 2.8/2.10/2.12/2.14/2.16, đơn vị %).
// Dùng cho công trình THIẾT KẾ 2 BƯỚC (chỉ BVTC, không yêu cầu thiết kế kỹ thuật).
// Đây là tỷ lệ phí cuối, KHÔNG nhân hệ số BVTC. Cấp IV chỉ tới 500 tỷ.
const DESIGN_BVTC_PCT: Record<string, Record<string, [number, number][]>> = {
  // Bảng 2.8
  "Dân dụng": {
    "Cấp đặc biệt": pct(COST_FULL, [4.66, 4.05, 3.41, 3.10, 2.83, 2.39, 1.93, 1.65, 1.28, 0.99, 0.91]),
    "Cấp I": pct(COST_FULL, [4.22, 3.66, 3.10, 2.82, 2.57, 2.17, 1.76, 1.51, 1.16, 0.90, 0.80]),
    "Cấp II": pct(COST_FULL, [3.85, 3.33, 2.80, 2.54, 2.34, 1.98, 1.61, 1.36, 1.06, 0.82, 0.72]),
    "Cấp III": pct(COST_FULL, [3.41, 2.95, 2.48, 2.25, 2.07, 1.75, 1.43, 1.20, 0.94, 0.72, 0.63]),
    "Cấp IV": pct(COST_IV6, [2.92, 2.55, 2.12, 1.86, 1.51, 1.30]),
  },
  // Bảng 2.10
  "Công nghiệp": {
    "Cấp đặc biệt": pct(COST_FULL, [4.70, 4.27, 3.66, 3.32, 3.01, 2.75, 2.40, 2.03, 1.52, 1.21, 1.04]),
    "Cấp I": pct(COST_FULL, [3.87, 3.57, 3.02, 2.77, 2.50, 2.28, 2.01, 1.70, 1.26, 1.02, 0.88]),
    "Cấp II": pct(COST_FULL, [3.13, 2.90, 2.43, 2.24, 2.03, 1.90, 1.66, 1.42, 1.04, 0.82, 0.72]),
    "Cấp III": pct(COST_FULL, [2.78, 2.57, 2.16, 1.99, 1.79, 1.68, 1.47, 1.25, 0.91, 0.72, 0.64]),
    "Cấp IV": pct(COST_IV6, [2.46, 2.25, 1.89, 1.72, 1.47, 1.22]),
  },
  // Bảng 2.12
  "Giao thông": {
    "Cấp đặc biệt": pct(COST_FULL, [3.01, 2.76, 2.36, 2.15, 1.95, 1.78, 1.52, 1.32, 1.02, 0.75, 0.66]),
    "Cấp I": pct(COST_FULL, [2.27, 2.15, 1.83, 1.67, 1.51, 1.38, 1.21, 1.03, 0.79, 0.61, 0.49]),
    "Cấp II": pct(COST_FULL, [1.67, 1.55, 1.32, 1.20, 1.10, 1.01, 0.85, 0.72, 0.56, 0.42, 0.36]),
    "Cấp III": pct(COST_FULL, [1.48, 1.37, 1.17, 1.06, 0.97, 0.82, 0.70, 0.59, 0.45, 0.33, 0.29]),
    "Cấp IV": pct(COST_IV6, [1.37, 1.26, 1.08, 0.98, 0.83, 0.71]),
  },
  // Bảng 2.14
  "Nông nghiệp & môi trường": {
    "Cấp đặc biệt": pct(COST_FULL, [4.29, 3.75, 3.17, 2.85, 2.60, 2.21, 1.87, 1.58, 1.22, 0.95, 0.83]),
    "Cấp I": pct(COST_FULL, [3.89, 3.40, 2.87, 2.57, 2.36, 2.00, 1.69, 1.43, 1.10, 0.85, 0.74]),
    "Cấp II": pct(COST_FULL, [3.53, 3.11, 2.62, 2.34, 2.15, 1.73, 1.48, 1.25, 0.96, 0.69, 0.58]),
    "Cấp III": pct(COST_FULL, [3.13, 2.76, 2.31, 2.07, 1.79, 1.52, 1.29, 1.10, 0.83, 0.60, 0.51]),
    "Cấp IV": pct(COST_IV6, [2.48, 2.19, 1.82, 1.61, 1.41, 1.14]),
  },
  // Bảng 2.16
  "Hạ tầng kỹ thuật": {
    "Cấp đặc biệt": pct(COST_FULL, [3.23, 2.79, 2.35, 2.13, 1.95, 1.64, 1.39, 1.19, 0.90, 0.70, 0.63]),
    "Cấp I": pct(COST_FULL, [3.01, 2.63, 2.21, 1.99, 1.82, 1.49, 1.28, 1.07, 0.79, 0.58, 0.49]),
    "Cấp II": pct(COST_FULL, [2.68, 2.33, 1.97, 1.77, 1.58, 1.32, 1.14, 0.92, 0.70, 0.51, 0.43]),
    "Cấp III": pct(COST_FULL, [2.36, 2.01, 1.72, 1.55, 1.39, 1.16, 1.02, 0.81, 0.61, 0.44, 0.36]),
    "Cấp IV": pct(COST_IV6, [2.07, 1.76, 1.49, 1.35, 1.15, 0.98]),
  },
};

// Tra tỷ lệ phí thiết kế theo loại × cấp × chi phí xây dựng (tỷ đồng) và số bước thiết kế.
//  - 3 bước (có TK kỹ thuật + BVTC): Bảng lẻ (2.7…) × hệ số BVTC (1.55, công nghiệp 1.60)
//  - 2 bước (chỉ BVTC, không yêu cầu TK kỹ thuật): Bảng chẵn (2.8…), lấy thẳng
function designRateFor(
  constructionType: string,
  grade: string,
  valueBillions: number,
  designStep: number = 3,
): number {
  if (designStep === 2) {
    const typeTables = DESIGN_BVTC_PCT[constructionType] ?? DESIGN_BVTC_PCT["Dân dụng"];
    const table = typeTables[grade] ?? typeTables["Cấp III"];
    return interpolateRate(table, valueBillions);
  }
  const typeTables = DESIGN_TECH_PCT[constructionType] ?? DESIGN_TECH_PCT["Dân dụng"];
  const table = typeTables[grade] ?? typeTables["Cấp III"];
  const mult = DESIGN_BVTC_MULTIPLIER[constructionType] ?? 1.55;
  return interpolateRate(table, valueBillions) * mult;
}

// Nt = Nb − (Nb−Na)/(Ga−Gb) × (Gt−Gb)  ≡ standard linear interpolation
function interpolateRate(table: [number, number][], valueInBillions: number): number {
  if (valueInBillions <= table[0][0]) return table[0][1];
  if (valueInBillions >= table[table.length - 1][0]) return table[table.length - 1][1];
  for (let i = 0; i < table.length - 1; i++) {
    const [x0, y0] = table[i];
    const [x1, y1] = table[i + 1];
    if (valueInBillions >= x0 && valueInBillions <= x1) {
      return y0 + ((valueInBillions - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return table[table.length - 1][1];
}

// ─── Financial Calculation Engine ────────────────────────────────────────────

function calculateContractType(input: FinancialInput, isType2: boolean): ContractResult {
  const kickbackRate = isType2 ? input.kickbackRateType2 : input.kickbackRateType1;
  const signingCostRate = isType2 ? input.signingCostRateType2 : input.signingCostRateType1;

  const revenue = input.constructionValue * (input.supervisionRate + input.designRate);
  const kickback = revenue * kickbackRate;

  const directorLaborAnnual = input.directorSalaryMonthly * 12;
  const accountantLaborAnnual = input.accountantSalaryMonthly * 12;

  let laborCost: number;
  let technicianWageRatio: number;

  // ── Wage fund constraint (Type 2 only, technicians only — director & accountant excluded) ──
  const maxWageFundRate = input.maxWageFundRate ?? 0.15;
  const wageFundLimit = isType2 ? revenue * maxWageFundRate : 0;
  const costPerTechnician = input.technicianSalaryMonthly * 12 * (1 + input.insuranceRate);
  const maxTechniciansAllowed = isType2
    ? (wageFundLimit > 0 && costPerTechnician > 0
        ? Math.floor(wageFundLimit / costPerTechnician)
        : 0)
    : 0;

  if (isType2) {
    const technicianLaborAnnual = input.technicianSalaryMonthly * 12 * input.numTechnicians;
    laborCost = (directorLaborAnnual + accountantLaborAnnual + technicianLaborAnnual) * (1 + input.insuranceRate);
    technicianWageRatio = technicianLaborAnnual / revenue;
  } else {
    laborCost = (directorLaborAnnual + accountantLaborAnnual) * (1 + input.insuranceRate);
    technicianWageRatio = 0;
  }

  // Wage fund tracks technician cost only (director + accountant excluded)
  const technicianCostOnly = isType2
    ? input.technicianSalaryMonthly * 12 * input.numTechnicians * (1 + input.insuranceRate)
    : 0;
  const wageFundUsed = technicianCostOnly;
  const wageFundRemaining = isType2 ? wageFundLimit - wageFundUsed : 0;
  const wageFundExceeded = isType2 ? wageFundUsed > wageFundLimit : false;

  const fixedCost = (input.officeRentMonthly + input.travelEntertainMonthly + input.otherCostMonthly) * 12;
  const signingCost = revenue * signingCostRate;
  const signingCostDeductible = signingCost * 0.9;

  const vatRate = input.vatRate;
  const vatOut = revenue * vatRate;
  const deductibleRate = input.fixedCostDeductibleRate ?? 0.8;
  const vatIn = fixedCost * vatRate * deductibleRate;
  const vatDue = Math.max(0, vatOut - vatIn);

  // Kickback is a non-deductible outflow: it reduces net profit but stays in the CIT taxable base.
  // taxableIncome = revenue - labor - fixed - signingDeductible (kickback NOT deducted)
  const taxableIncome = Math.max(0, revenue - laborCost - fixedCost - signingCostDeductible);
  const corporateTax = taxableIncome * input.corporateTaxRate;
  // Net profit: lãi ròng = lãi trước thuế − thuế TNDN + VAT đầu vào đã trả nhà cung cấp
  // VAT là khoản thu hộ (thu của KH, nộp cho nhà nước); vatIn đã nằm trong fixedCost nên cộng lại
  const cashFlowBeforeTax = revenue - kickback - laborCost - fixedCost - signingCost;
  const netProfit = cashFlowBeforeTax - corporateTax + vatIn;
  const netProfitMonthly = netProfit / 12;
  const netMargin = netProfit / revenue;

  // Breakeven: solve netProfit = 0
  // netProfit = R*(1-k-s) - L - F - R*(1-0.9*s)*t + (L+F)*t + F*v*dr
  //           = R*(1 - k - s - t + 0.9*s*t) - (L+F)*(1-t) + F*v*dr
  const effectiveFactor = 1 - kickbackRate - signingCostRate - input.corporateTaxRate
    + 0.9 * signingCostRate * input.corporateTaxRate;
  const fixedBurden = (laborCost + fixedCost) * (1 - input.corporateTaxRate) - fixedCost * vatRate * deductibleRate;
  const breakEvenRevenue = effectiveFactor > 0 ? fixedBurden / effectiveFactor : 0;

  return {
    revenue, kickback, laborCost, signingCost, fixedCost,
    taxableIncome, corporateTax, vatOut, vatIn, vatDue,
    netProfit, netProfitMonthly, netMargin, cashFlowBeforeTax,
    breakEvenRevenue, technicianWageRatio,
    isViable: netProfit >= 0,
    wageFundLimit,
    wageFundUsed,
    wageFundRemaining,
    maxTechniciansAllowed,
    wageFundExceeded,
  };
}

// ─── Optimization Engine (Phương án tối ưu thuế - Excel sheet logic) ─────────

const ALLOCATION_META: Array<{
  key: string;
  name: string;
  legalBasis: string;
  practiceNote: string;
  defaultL1: number;
  defaultL2: number;
}> = [
  {
    key: "training",
    name: "1. Đào tạo & nâng cao năng lực",
    legalBasis: "Điều 4.2 TT 96/2015/TT-BTC",
    practiceNote: "Khóa học PM, BIM, quản lý DA; cần HĐ + chứng chỉ",
    defaultL1: 20, defaultL2: 20,
  },
  {
    key: "equipment",
    name: "2. Thiết bị & phần mềm chuyên ngành",
    legalBasis: "TT 45/2013/TT-BTC – CP công cụ dụng cụ",
    practiceNote: "AutoCAD, Revit, MS Project, máy tính, máy in A0; <30tr ghi thẳng, ≥30tr khấu hao",
    defaultL1: 25, defaultL2: 25,
  },
  {
    key: "office",
    name: "3. Chi phí văn phòng & quản lý nâng cao",
    legalBasis: "Điều 4 TT 78/2014/TT-BTC – CP quản lý",
    practiceNote: "Nâng hạng VP, văn phòng phẩm chuyên dụng, bảo hiểm VP",
    defaultL1: 15, defaultL2: 15,
  },
  {
    key: "consultants",
    name: "4. Thuê chuyên gia / cộng tác viên kỹ thuật",
    legalBasis: "Điều 25 TT 111/2013 – khấu trừ TNCN 10% nếu ≥2tr/lần",
    practiceNote: "HĐ dịch vụ cá nhân/tổ chức; cần HĐ + chứng từ chuyển khoản",
    defaultL1: 20, defaultL2: 25,
  },
  {
    key: "marketing",
    name: "5. Chi phí marketing & phát triển kinh doanh",
    legalBasis: "Khoản 21 Điều 4 TT 96/2015 – tối đa 15% tổng CP được trừ",
    practiceNote: "Website, hội thảo, in ấn hồ sơ năng lực; cần kiểm soát trần 15%",
    defaultL1: 10, defaultL2: 10,
  },
  {
    key: "other",
    name: "6. Dự phòng & chi phí phát sinh khác",
    legalBasis: "Điều 4 TT 78/2014/TT-BTC – CP phát sinh hợp lệ",
    practiceNote: "Phụ lục HĐ, bảo trì TB, bảo hiểm trách nhiệm nghề nghề",
    defaultL1: 10, defaultL2: 5,
  },
];

const LEGAL_NOTES = [
  "• Tất cả chi phí hợp thức hóa phải có HĐ VAT hợp lệ, thanh toán không dùng tiền mặt (>20 triệu) theo Điều 15 TT 219/2013/TT-BTC.",
  "• Chi phí đào tạo được KT toàn bộ nếu có kế hoạch đào tạo, HĐ với cơ sở đào tạo, danh sách học viên (Điều 4.2 TT 96/2015/TT-BTC).",
  "• Chi phí CCDC, thiết bị <30 triệu: ghi thẳng vào chi phí; ≥30 triệu: phải phân bổ khấu hao (Thông tư 45/2013/TT-BTC).",
  "• Chi phí thuê CTV/chuyên gia: ký HĐ dịch vụ, khấu trừ thuế TNCN tại nguồn 10% nếu thu nhập ≥2 triệu/lần (Điều 25 TT 111/2013).",
  "• Chi phí QC/marketing: tối đa 15% tổng chi phí được trừ trong năm (Khoản 21 Điều 4 TT 96/2015/TT-BTC).",
  "• Sheet này mang tính tham khảo nội bộ; cần tư vấn kế toán/thuế trước khi áp dụng thực tế.",
];

/**
 * Analytical formula for required revenue to achieve targetNetProfit.
 * Kickback is non-deductible for CIT — no tax shield.
 * netProfit = R*(1 - k - s - t + 0.9*s*t - v) - (L+F)*(1-t) + F*v*dr
 * Solving for R:
 */
function computeRequiredRevenue(
  input: FinancialInput,
  isType2: boolean,
  targetNetProfit: number,
): number {
  const k = isType2 ? input.kickbackRateType2 : input.kickbackRateType1;
  const s = isType2 ? input.signingCostRateType2 : input.signingCostRateType1;
  const t = input.corporateTaxRate;
  const v = input.vatRate;
  const dr = input.fixedCostDeductibleRate ?? 0.8;

  const directorAnnual = input.directorSalaryMonthly * 12;
  const accountantAnnual = input.accountantSalaryMonthly * 12;
  let L: number;
  if (isType2) {
    L = (directorAnnual + accountantAnnual + input.technicianSalaryMonthly * 12 * input.numTechnicians) * (1 + input.insuranceRate);
  } else {
    L = (directorAnnual + accountantAnnual) * (1 + input.insuranceRate);
  }
  const F = (input.officeRentMonthly + input.travelEntertainMonthly + input.otherCostMonthly) * 12;

  // Kickback not deductible for CIT — k*t term removed
  const effectiveFactor = 1 - k - s - t + 0.9 * s * t - v;
  const fixedTerms = -(L + F) * (1 - t) + F * v * dr;

  if (effectiveFactor <= 0) return Infinity;
  return (targetNetProfit - fixedTerms) / effectiveFactor;
}

/**
 * Binary search for the kickback rate that achieves targetNetProfit at current revenue.
 * Lower kickback → higher profit.
 */
function computeRequiredKickbackRate(
  input: FinancialInput,
  isType2: boolean,
  targetNetProfit: number,
): number {
  let lo = 0;
  let hi = isType2 ? input.kickbackRateType2 : input.kickbackRateType1;

  // Check if achievable at all (kickback = 0)
  const testInput = { ...input, kickbackRateType1: 0, kickbackRateType2: 0 };
  const maxProfit = calculateContractType(testInput, isType2).netProfit;
  if (maxProfit < targetNetProfit) return -1; // not achievable even at 0% kickback

  for (let iter = 0; iter < 60; iter++) {
    const mid = (lo + hi) / 2;
    const testIn = isType2
      ? { ...input, kickbackRateType2: mid }
      : { ...input, kickbackRateType1: mid };
    const profit = calculateContractType(testIn, isType2).netProfit;
    if (profit > targetNetProfit) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

function computeOptimize(
  input: FinancialInput,
  isType2: boolean,
  targetNetProfit: number,
  allocation: { training: number; equipment: number; office: number; consultants: number; marketing: number; other: number },
): OptimizeContractResult {
  const current = calculateContractType(input, isType2);

  // ── Section I: Current state ──────────────────────────────────────────────
  const currentNetProfit = current.netProfit;

  // ── Section II: Breakeven analysis ───────────────────────────────────────
  const breakevenRevenue = current.breakEvenRevenue;
  const safetyMarginVND = current.revenue - breakevenRevenue;
  const revenueGapPct = breakevenRevenue > 0 ? (current.revenue / breakevenRevenue) - 1 : 0;

  // ── Section III: Required additional deductible cost ──────────────────────
  // Model: additional deductible expenses reduce CIT only (not shown as reducing profit).
  // Case A — profit > target: add real costs until profit drops to target.
  //   requiredAdditionalCost = (currentProfit - target) / (1 - taxRate)
  // Case B — profit < target: need CIT savings to bridge the gap.
  //   citSavingNeeded = target - currentProfit
  //   requiredAdditionalCost = citSavingNeeded / taxRate  (deduct enough to save that much CIT)
  //
  // Feasibility: citSavingNeeded must be ≤ 100% of current CIT (tối đa xóa hết thuế TNDN).
  // When exceeded → scenario = "too_high" (kỳ vọng quá cao).

  const citSavingNeeded = Math.max(0, targetNetProfit - currentNetProfit);
  const requiredAdditionalCost = currentNetProfit >= targetNetProfit
    ? Math.max(0, (currentNetProfit - targetNetProfit) / (1 - input.corporateTaxRate))
    : citSavingNeeded / input.corporateTaxRate;
  const requiredAdditionalCostMonthly = requiredAdditionalCost / 12;

  // Scenario: feasible khi tiết kiệm thuế cần ≤ 100% thuế TNDN hiện tại
  const maxFeasibleCITSaving = current.corporateTax;
  const scenario: string = citSavingNeeded > maxFeasibleCITSaving ? "too_high" : "feasible";

  // ── Section IV: Allocation breakdown ─────────────────────────────────────
  const totalAlloc = Object.values(allocation).reduce((a, b) => a + b, 0);
  const isAllocationValid = Math.abs(totalAlloc - 100) < 0.01;

  const allocationBreakdown: AllocationItem[] = ALLOCATION_META.map((meta) => {
    const pct = allocation[meta.key as keyof typeof allocation] ?? 0;
    const amount = requiredAdditionalCost * (pct / 100);
    return {
      category: meta.name,
      percentage: pct,
      amount,
      amountMonthly: amount / 12,
      legalBasis: meta.legalBasis,
      practiceNote: meta.practiceNote,
    };
  });

  // ── Section V: After optimize ─────────────────────────────────────────────
  const afterOptimizeTaxableIncome = Math.max(0, current.taxableIncome - requiredAdditionalCost);
  const afterOptimizeCorporateTax = afterOptimizeTaxableIncome * input.corporateTaxRate;
  const taxSaving = Math.max(0, current.corporateTax - afterOptimizeCorporateTax);
  // After optimize: achieves targetNetProfit when feasible (both Case A and Case B)
  const afterOptimizeNetProfit = scenario === "feasible"
    ? targetNetProfit
    : currentNetProfit + taxSaving;  // too_high: partial benefit only
  const afterOptimizeNetProfitMonthly = afterOptimizeNetProfit / 12;
  const afterOptimizeNetMargin = current.revenue > 0 ? afterOptimizeNetProfit / current.revenue : 0;

  const requiredRevenueForTarget = computeRequiredRevenue(input, isType2, targetNetProfit);
  const requiredRevenueIncreaseVND = Math.max(0, requiredRevenueForTarget - current.revenue);
  const requiredRevenueIncreasePct = current.revenue > 0 ? requiredRevenueIncreaseVND / current.revenue : 0;
  const requiredKickbackRateForTarget = computeRequiredKickbackRate(input, isType2, targetNetProfit);
  const requiredCostReductionForTarget = 0;

  return {
    scenario,
    currentNetProfit,
    currentNetProfitMonthly: current.netProfitMonthly,
    currentNetMargin: current.netMargin,
    currentTaxableIncome: current.taxableIncome,
    currentCorporateTax: current.corporateTax,
    currentVatDue: current.vatDue,
    targetNetProfit,
    targetNetProfitMonthly: targetNetProfit / 12,
    breakevenRevenue,
    currentRevenue: current.revenue,
    safetyMarginVND,
    revenueGapPct,
    requiredAdditionalCost,
    requiredAdditionalCostMonthly,
    isAllocationValid,
    allocationBreakdown,
    afterOptimizeTaxableIncome,
    afterOptimizeCorporateTax,
    afterOptimizeNetProfit,
    afterOptimizeNetProfitMonthly,
    afterOptimizeNetMargin,
    taxSaving,
    requiredRevenueForTarget,
    requiredRevenueIncreaseVND,
    requiredRevenueIncreasePct,
    requiredKickbackRateForTarget,
    requiredCostReductionForTarget,
    legalNotes: LEGAL_NOTES,
  };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

router.post("/financial/fee-rates", (req: Request, res: Response): void => {
  const body = req.body as FeeRateInput & { constructionType?: string; designStep?: number };
  if (!body.constructionValue || !body.constructionGrade) {
    res.status(400).json({ error: "constructionValue and constructionGrade are required" });
    return;
  }
  const valueBillions = body.constructionValue / 1_000_000_000;
  const constructionType = body.constructionType ?? "Dân dụng";
  const designStep = body.designStep === 2 ? 2 : 3; // mặc định 3 bước nếu không truyền
  const supervisionTable = SUPERVISION_TABLES[constructionType] ?? SUPERVISION_TABLES["Dân dụng"];
  const supervisionRate = interpolateRate(supervisionTable, valueBillions);
  // Thiết kế: 2 bước (chỉ BVTC, Bảng chẵn) hoặc 3 bước (TKKT + BVTC, Bảng lẻ × hệ số)
  const designRate = designRateFor(constructionType, body.constructionGrade, valueBillions, designStep);
  const vatRate = 0.08;
  const supervisionFee = body.constructionValue * supervisionRate;
  const designFee = body.constructionValue * designRate;
  const totalExcl = supervisionFee + designFee;
  const vatAmount = totalExcl * vatRate;
  res.json({ supervisionRate, designRate, supervisionFee, designFee, vatAmount, totalWithVat: totalExcl + vatAmount });
});

router.post("/financial/calculate", (req: Request, res: Response): void => {
  const input = req.body as FinancialInput;
  if (!input.constructionValue || input.constructionValue <= 0) {
    res.status(400).json({ error: "constructionValue must be greater than 0" });
    return;
  }
  const supervisionRevenue = input.constructionValue * input.supervisionRate;
  const designRevenue = input.constructionValue * input.designRate;
  const totalRevenue = supervisionRevenue + designRevenue;
  const type1 = calculateContractType(input, false);
  const type2 = calculateContractType(input, true);

  let recommendation = "";
  if (type1.netProfit < 0 && type2.netProfit < 0) {
    recommendation = "Cả 2 loại hợp đồng đều lỗ — cần tối ưu chi phí hoặc đàm phán lại tỷ lệ cắt lại";
  } else if (type1.netProfit > type2.netProfit && type1.corporateTax <= type2.corporateTax) {
    recommendation = "Loại 1 tối ưu hơn về dòng tiền ròng";
  } else if (type2.corporateTax < type1.corporateTax) {
    recommendation = "Loại 2 tiết kiệm thuế TNDN nhờ chi phí lao động cao hơn";
  } else {
    recommendation = "Cần tối ưu chi phí hợp lệ để cải thiện lãi ròng";
  }

  res.json({ supervisionRevenue, designRevenue, totalRevenue, type1, type2, recommendation });
});

router.post("/financial/optimize", (req: Request, res: Response): void => {
  const body = req.body as OptimizeInput & { targetNetProfitType1?: number; targetNetProfitType2?: number };
  const { financialInput, targetNetProfit, allocationL1, allocationL2 } = body;

  // Mục tiêu lãi ròng có thể khác nhau cho từng loại HĐ; fallback về targetNetProfit chung
  const target1 = body.targetNetProfitType1 ?? targetNetProfit;
  const target2 = body.targetNetProfitType2 ?? targetNetProfit;

  if (!financialInput || target1 === undefined || target2 === undefined) {
    res.status(400).json({ error: "financialInput and target net profit (chung hoặc theo từng loại) are required" });
    return;
  }

  const defaultAlloc = { training: 20, equipment: 25, office: 15, consultants: 20, marketing: 10, other: 10 };

  res.json({
    type1: computeOptimize(financialInput, false, target1, allocationL1 ?? defaultAlloc),
    type2: computeOptimize(financialInput, true, target2, allocationL2 ?? defaultAlloc),
  });
});

router.get("/financial/scenarios", (_req: Request, res: Response): void => {
  const defaultInput: FinancialInput = {
    constructionValue: 15_000_000_000,
    supervisionRate: 0.03285,
    designRate: 0.0341,
    kickbackRateType1: 0.55,
    kickbackRateType2: 0.40,
    corporateTaxRate: 0.17,
    directorSalaryMonthly: 15_000_000,
    numTechnicians: 1,
    technicianSalaryMonthly: 15_000_000,
    accountantSalaryMonthly: 3_000_000,
    officeRentMonthly: 3_000_000,
    travelEntertainMonthly: 5_000_000,
    otherCostMonthly: 3_000_000,
    insuranceRate: 0.215,
    vatRate: 0.08,
    signingCostRateType1: 0.05,
    signingCostRateType2: 0.02,
    fixedCostDeductibleRate: 0.8,
  };

  const scenarios: Scenario[] = [
    {
      id: "default",
      name: "Cơ sở (mặc định)",
      description: "Gói 15 tỷ, cắt lại L1 55% / L2 40%",
      input: defaultInput,
    },
    {
      id: "small-package",
      name: "Gói nhỏ – 9 tỷ",
      description: "Gói thầu nhỏ hơn, tỷ lệ phí cao hơn",
      input: { ...defaultInput, constructionValue: 9_000_000_000, supervisionRate: 0.038, designRate: 0.043 },
    },
    {
      id: "good-negotiation",
      name: "Đàm phán tốt",
      description: "Cắt lại thấp hơn: L1 45% / L2 35%",
      input: { ...defaultInput, kickbackRateType1: 0.45, kickbackRateType2: 0.35 },
    },
    {
      id: "large-package",
      name: "Gói lớn – 30 tỷ",
      description: "Mở rộng quy mô gói thầu lên 30 tỷ",
      input: {
        ...defaultInput,
        constructionValue: 30_000_000_000,
        supervisionRate: 0.029,
        designRate: 0.032,
        kickbackRateType1: 0.50,
        kickbackRateType2: 0.38,
      },
    },
    {
      id: "expanded-staff",
      name: "Mở rộng nhân sự L2",
      description: "Thêm 2 kỹ sư trực tiếp",
      input: { ...defaultInput, numTechnicians: 2 },
    },
  ];

  res.json(scenarios);
});

export default router;

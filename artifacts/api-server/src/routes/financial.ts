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

// ─── TT 12/2021 Fee Rate Tables ─────────────────────────────────────────────

const SUPERVISION_TABLE: [number, number][] = [
  [1, 0.055], [5, 0.045], [10, 0.038], [20, 0.033], [50, 0.028],
  [100, 0.025], [200, 0.022], [500, 0.019], [1000, 0.016], [5000, 0.014],
];

const DESIGN_TABLES: Record<string, [number, number][]> = {
  "Cấp đặc biệt": [
    [1, 0.045], [5, 0.038], [10, 0.033], [20, 0.029], [50, 0.026],
    [100, 0.023], [200, 0.021], [500, 0.019], [1000, 0.017], [5000, 0.015],
  ],
  "Cấp I": [
    [1, 0.05], [5, 0.042], [10, 0.036], [20, 0.032], [50, 0.028],
    [100, 0.025], [200, 0.022], [500, 0.02], [1000, 0.018], [5000, 0.016],
  ],
  "Cấp II": [
    [1, 0.054], [5, 0.046], [10, 0.04], [20, 0.035], [50, 0.031],
    [100, 0.027], [200, 0.024], [500, 0.021], [1000, 0.019], [5000, 0.017],
  ],
  "Cấp III": [
    [1, 0.058], [5, 0.049], [10, 0.043], [20, 0.038], [50, 0.033],
    [100, 0.029], [200, 0.026], [500, 0.023], [1000, 0.02], [5000, 0.018],
  ],
  "Cấp IV": [
    [1, 0.062], [5, 0.053], [10, 0.047], [20, 0.041], [50, 0.036],
    [100, 0.031], [200, 0.027], [500, 0.024], [1000, 0.021], [5000, 0.019],
  ],
};

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
  // Feasibility: citSavingNeeded must be ≤ 90% of current CIT.
  // When exceeded → scenario = "too_high" (kỳ vọng quá cao).

  const citSavingNeeded = Math.max(0, targetNetProfit - currentNetProfit);
  const requiredAdditionalCost = currentNetProfit >= targetNetProfit
    ? Math.max(0, (currentNetProfit - targetNetProfit) / (1 - input.corporateTaxRate))
    : citSavingNeeded / input.corporateTaxRate;
  const requiredAdditionalCostMonthly = requiredAdditionalCost / 12;

  // Scenario: feasible when citSavingNeeded ≤ 90% of current CIT
  const maxFeasibleCITSaving = current.corporateTax * 0.9;
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
  const body = req.body as FeeRateInput;
  if (!body.constructionValue || !body.constructionGrade) {
    res.status(400).json({ error: "constructionValue and constructionGrade are required" });
    return;
  }
  const valueBillions = body.constructionValue / 1_000_000_000;
  const supervisionRate = interpolateRate(SUPERVISION_TABLE, valueBillions);
  const designTable = DESIGN_TABLES[body.constructionGrade] ?? DESIGN_TABLES["Cấp III"];
  const designRate = interpolateRate(designTable, valueBillions);
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
  const { financialInput, targetNetProfit, allocationL1, allocationL2 } = req.body as OptimizeInput;

  if (!financialInput || targetNetProfit === undefined) {
    res.status(400).json({ error: "financialInput and targetNetProfit are required" });
    return;
  }

  const defaultAlloc = { training: 20, equipment: 25, office: 15, consultants: 20, marketing: 10, other: 10 };

  res.json({
    type1: computeOptimize(financialInput, false, targetNetProfit, allocationL1 ?? defaultAlloc),
    type2: computeOptimize(financialInput, true, targetNetProfit, allocationL2 ?? defaultAlloc),
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

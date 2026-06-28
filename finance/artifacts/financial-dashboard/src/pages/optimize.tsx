import { useFinancial } from "@/context/FinancialContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useOptimize } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, TrendingDown, CheckCircle2, AlertTriangle,
  ShieldCheck, UserPlus,
} from "lucide-react";
import { useState } from "react";
import { formatVND, formatPercent } from "@/lib/utils";
import type { CostAllocation, OptimizeContractResult } from "@workspace/api-client-react";
import { Link } from "wouter";

// ── Helpers ──────────────────────────────────────────────────────────────────
function StatPill({
  label, value, color = "",
}: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-bold ${color}`}>{value}</span>
    </div>
  );
}

// ── Tax situation summary ─────────────────────────────────────────────────────
function TaxSnapshot({ d, contractLabel }: { d: OptimizeContractResult; contractLabel: string }) {
  const profitColor = d.currentNetProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{contractLabel}</div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <StatPill label="Doanh thu (chưa VAT)" value={formatVND(d.currentRevenue)} />
        <StatPill label="Lãi gộp chịu thuế TNDN" value={formatVND(d.currentTaxableIncome)} />
        <StatPill
          label="Thuế TNDN phải nộp"
          value={formatVND(d.currentCorporateTax)}
          color="text-red-600 dark:text-red-400"
        />
        <StatPill
          label="Lãi ròng / năm"
          value={`${formatVND(d.currentNetProfit)} (${formatVND(d.currentNetProfitMonthly)}/tháng)`}
          color={profitColor}
        />
      </div>
    </div>
  );
}

// ── Too-high warning (target exceeds 90% of CIT) ─────────────────────────────
function TooHighWarning({ d }: { d: OptimizeContractResult }) {
  const maxSaveable = d.currentCorporateTax * 0.9;
  const maxReachable = d.currentNetProfit + maxSaveable;
  return (
    <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-5 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-red-800 dark:text-red-300">
          Kỳ vọng quá cao — Không đạt được chỉ bằng tối ưu thuế TNDN
        </p>
        <p className="text-xs text-red-700 dark:text-red-400">
          Mục tiêu lãi ròng <strong>{formatVND(d.targetNetProfit)}</strong> yêu cầu tiết kiệm thuế cao hơn 90% số thuế TNDN hiện tại ({formatVND(d.currentCorporateTax)}).
          Tối đa có thể tiết kiệm: <strong>{formatVND(maxSaveable)}</strong> → đạt lãi ròng tối đa <strong>{formatVND(maxReachable)}</strong> qua tối ưu thuế.
        </p>
        <p className="text-xs text-red-700 dark:text-red-400">
          👉 Hãy giảm mục tiêu về ≤ {formatVND(Math.floor(maxReachable / 1_000_000) * 1_000_000)} hoặc kết hợp thêm các biện pháp tăng doanh thu.
        </p>
      </div>
    </div>
  );
}


// ── Before / after comparison ─────────────────────────────────────────────────
function BeforeAfter({ d }: { d: OptimizeContractResult }) {
  if (d.scenario === "too_high") return null;

  const rows = [
    { label: "Chi phí hợp lệ thêm vào", before: 0, after: d.requiredAdditionalCost, good: true },
    { label: "Lãi gộp chịu thuế TNDN", before: d.currentTaxableIncome, after: d.afterOptimizeTaxableIncome, good: false },
    { label: "Thuế TNDN phải nộp", before: d.currentCorporateTax, after: d.afterOptimizeCorporateTax, good: false },
    { label: "Thuế TNDN tiết kiệm", before: 0, after: d.taxSaving, good: true, highlight: true },
    { label: "Lãi ròng / năm", before: d.currentNetProfit, after: d.afterOptimizeNetProfit, good: true },
    { label: "Lãi ròng / tháng", before: d.currentNetProfitMonthly, after: d.afterOptimizeNetProfitMonthly, good: true },
    { label: "Biên lãi ròng", before: d.currentNetMargin, after: d.afterOptimizeNetMargin, good: true, format: "percent" as const },
  ];

  return (
    <Card>
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-sm">Bảng đối chiếu Trước / Sau tối ưu</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr>
              <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground text-left">Chỉ tiêu</th>
              <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground text-right">Trước</th>
              <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground text-right">Sau tối ưu</th>
              <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground text-right">Chênh lệch</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const diff = row.after - row.before;
              const fmt = (v: number) => row.format === "percent" ? formatPercent(v) : formatVND(v);
              const isGoodDiff = row.good ? diff > 0 : diff <= 0;
              const diffColor = diff === 0 ? "text-muted-foreground" : (isGoodDiff ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400");
              return (
                <tr key={i} className={`border-t border-border/40 ${row.highlight ? "bg-muted/30" : ""}`}>
                  <td className={`px-4 py-3 font-medium text-sm ${row.highlight ? "text-primary" : ""}`}>{row.label}</td>
                  <td className="px-4 py-3 text-right text-sm text-muted-foreground">{row.before === 0 && !row.highlight ? "—" : fmt(row.before)}</td>
                  <td className={`px-4 py-3 text-right text-sm font-bold ${row.highlight ? "text-green-600 dark:text-green-400" : ""}`}>{fmt(row.after)}</td>
                  <td className={`px-4 py-3 text-right text-sm font-semibold ${diffColor}`}>
                    {diff === 0 ? "—" : `${diff > 0 ? "+" : ""}${fmt(diff)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ── Legal checklist ───────────────────────────────────────────────────────────
function LegalChecklist({ notes }: { notes: string[] }) {
  return (
    <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <span className="text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wide">
          Điều kiện bắt buộc để chi phí được chấp nhận khấu trừ thuế
        </span>
      </div>
      <ul className="space-y-1.5">
        {notes.map((n, i) => (
          <li key={i} className="text-xs text-blue-800 dark:text-blue-400 flex items-start gap-1.5">
            <span className="mt-0.5 shrink-0">•</span>
            <span>{n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Exceeds taxable income warning ───────────────────────────────────────────
function ExceedsCITWarning({ d }: { d: OptimizeContractResult }) {
  if (d.requiredAdditionalCost <= d.currentTaxableIncome) return null;
  const excess = d.requiredAdditionalCost - d.currentTaxableIncome;
  return (
    <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20 p-4 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          Số tiền hợp thức hóa vượt quá lãi gộp chịu thuế TNDN
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Cần hợp thức hóa <strong>{formatVND(d.requiredAdditionalCost)}</strong>, trong khi lãi gộp chịu thuế TNDN chỉ là{" "}
          <strong>{formatVND(d.currentTaxableIncome)}</strong> — vượt <strong>{formatVND(excess)}</strong>.
          Hợp thức hóa chi phí vượt toàn bộ lãi gộp sẽ đẩy doanh nghiệp vào lỗ trên sổ sách, dễ bị cơ quan thuế kiểm tra và không có lợi về dài hạn.
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-400">
          👉 Cân nhắc giảm lãi ròng kỳ vọng hoặc kết hợp các biện pháp tăng doanh thu thay vì chỉ dựa vào hợp thức hóa chi phí.
        </p>
      </div>
    </div>
  );
}

// ── Result panel for one contract type ───────────────────────────────────────
function ContractOptimizeResult({ d, label }: { d: OptimizeContractResult; label: string }) {
  const isFeasible = d.scenario !== "too_high";
  const taxRate = d.currentTaxableIncome > 0 ? d.currentCorporateTax / d.currentTaxableIncome : 0;

  return (
    <div className="space-y-5">
      <TaxSnapshot d={d} contractLabel={label} />

      {isFeasible ? (
        <>
          <ExceedsCITWarning d={d} />
          {/* Key insight banner */}
          <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                Cần hợp thức hóa thêm {formatVND(d.requiredAdditionalCost)} chi phí ({formatVND(d.requiredAdditionalCostMonthly)}/tháng)
              </p>
              <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                Thuế TNDN giảm {formatVND(d.taxSaving)}/năm — đạt lãi ròng mục tiêu {formatVND(d.targetNetProfit)}.
                Thuế suất TNDN: {formatPercent(taxRate)}.
              </p>
            </div>
          </div>

          <BeforeAfter d={d} />
          <LegalChecklist notes={d.legalNotes} />
        </>
      ) : (
        <TooHighWarning d={d} />
      )}
    </div>
  );
}

// ── Chiến thuật 7: Outsourced staff CIT calculator ───────────────────────────
function OutsourcedStaffCard({
  corporateTaxRate,
  optResult,
  activeTab,
}: {
  corporateTaxRate: number;
  optResult: { type1: OptimizeContractResult; type2: OptimizeContractResult } | null;
  activeTab: "type1" | "type2";
}) {
  const [numStaff, setNumStaff] = useState(1);
  const [monthlyGross, setMonthlyGross] = useState(10_000_000);
  const [contractType, setContractType] = useState<"ctv" | "hdld">("ctv");
  const [showComprehensive, setShowComprehensive] = useState(false);

  // PIT: 10% withheld at source when income ≥ 2M/payment (Điều 25 TT 111/2013)
  const hasPIT = monthlyGross >= 2_000_000;
  const pitPerMonth = hasPIT ? monthlyGross * 0.10 : 0;
  const pitAnnual = pitPerMonth * 12;

  // Employer insurance (HĐ lao động only): BHXH 17.5% + BHYT 3% + BHTN 1% = 21.5%
  const EMPLOYER_INS = 0.215;
  // Employee insurance: BHXH 8% + BHYT 1.5% + BHTN 1% = 10.5%
  const EMPLOYEE_INS = 0.105;
  // Base lương đóng BHXH = lương tối thiểu vùng (6 triệu)
  const MIN_WAGE_BASE = 6_000_000;

  const employerInsPerMonth = contractType === "hdld" ? MIN_WAGE_BASE * EMPLOYER_INS : 0;
  const employeeInsPerMonth = contractType === "hdld" ? MIN_WAGE_BASE * EMPLOYEE_INS : 0;

  // What the employee actually receives
  const netToEmployee = monthlyGross - pitPerMonth - (contractType === "hdld" ? employeeInsPerMonth : 0);

  // Total CASH out of company per person per month = gross + employer insurance
  // (PIT is withheld from employee gross, not extra cost to company)
  const companyCostPerMonth = monthlyGross + employerInsPerMonth;
  const companyCostAnnual = companyCostPerMonth * 12;

  // Totals for all staff
  const totalDeductibleAnnual = companyCostAnnual * numStaff;
  const citSaving = totalDeductibleAnnual * corporateTaxRate;
  const netCostAfterTax = totalDeductibleAnnual - citSaving;

  // ── Chi phí THỰC của công ty từ phần 7 (không tính gross salary vào chi phí thực)
  // Gross salary chỉ dùng để hợp thức hóa giảm lãi gộp chịu thuế
  const tncnAnnual = pitAnnual * numStaff;
  const insuranceAnnual = contractType === "hdld"
    ? (EMPLOYER_INS + EMPLOYEE_INS) * MIN_WAGE_BASE * 12 * numStaff
    : 0;
  const section7RealCost = tncnAnnual + insuranceAnnual;

  // ── Tổng hợp với optResult ────────────────────────────────────────────────
  const baseOpt = optResult?.[activeTab] ?? null;
  const comprehensiveResult = baseOpt ? (() => {
    const taxRate = corporateTaxRate;
    const combinedDeductible = (baseOpt.requiredAdditionalCost > 0 ? baseOpt.requiredAdditionalCost : 0) + totalDeductibleAnnual;
    const newTaxableIncome = Math.max(0, baseOpt.currentTaxableIncome - combinedDeductible);
    const newCIT = newTaxableIncome * taxRate;
    const additionalCITSaved = Math.max(0, baseOpt.afterOptimizeCorporateTax - newCIT);
    const totalCITSaved = baseOpt.taxSaving + additionalCITSaved;
    // Lãi ròng sau tổng hợp: không cộng gross vào chi phí thực, chỉ trừ TNCN + BH
    const finalNetProfit = baseOpt.afterOptimizeNetProfit + additionalCITSaved - section7RealCost;
    return {
      combinedDeductible,
      newTaxableIncome,
      newCIT,
      additionalCITSaved,
      totalCITSaved,
      finalNetProfit,
      finalNetProfitMonthly: finalNetProfit / 12,
    };
  })() : null;

  return (
    <Card className="border-purple-200 dark:border-purple-800">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center shrink-0">7</div>
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-purple-600" />
              Nhân viên thuê ngoài — Hạch toán chi phí lao động thực tế
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Thuê CTV / nhân viên ngắn hạn, kê khai lương + TNCN + BHXH đầy đủ. Toàn bộ được <strong>khấu trừ thuế TNDN</strong>.
              Công cụ hiển thị riêng để bạn tự quyết định có thực sự chi ra không.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-5 space-y-5">

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Số lượng (người)</Label>
            <Input
              type="number" min={1} value={numStaff}
              onChange={e => setNumStaff(Math.max(1, Number(e.target.value)))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Lương gross / người / tháng (VNĐ)</Label>
            <Input
              type="number" step={1_000_000} value={monthlyGross}
              onChange={e => setMonthlyGross(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Loại hợp đồng</Label>
            <div className="flex gap-2 h-10">
              {([
                { val: "ctv" as const, label: "HĐ dịch vụ / CTV" },
                { val: "hdld" as const, label: "HĐ lao động + BH" },
              ]).map(opt => (
                <button
                  key={opt.val}
                  onClick={() => setContractType(opt.val)}
                  className={`flex-1 rounded border text-xs font-medium transition-colors ${
                    contractType === opt.val
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Per-person breakdown table */}
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Chi tiết / người / tháng
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="px-4 py-2 text-xs font-medium text-muted-foreground text-left">Khoản mục</th>
                  <th className="px-4 py-2 text-xs font-medium text-muted-foreground text-right">/ Tháng</th>
                  <th className="px-4 py-2 text-xs font-medium text-muted-foreground text-right">/ Năm</th>
                  <th className="px-4 py-2 text-xs font-medium text-muted-foreground text-left hidden sm:table-cell">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {/* Gross salary */}
                <tr className="border-t border-border/40">
                  <td className="px-4 py-2.5 font-medium">Lương gross</td>
                  <td className="px-4 py-2.5 text-right">{formatVND(monthlyGross)}</td>
                  <td className="px-4 py-2.5 text-right">{formatVND(monthlyGross * 12)}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">Công ty chi ra</td>
                </tr>

                {/* PIT */}
                {hasPIT ? (
                  <tr className="border-t border-border/40 bg-amber-50/50 dark:bg-amber-950/10">
                    <td className="px-4 py-2.5 font-medium text-amber-800 dark:text-amber-300">
                      Khấu trừ TNCN 10% (tại nguồn)
                    </td>
                    <td className="px-4 py-2.5 text-right text-amber-700 dark:text-amber-400">
                      ({formatVND(pitPerMonth)})
                    </td>
                    <td className="px-4 py-2.5 text-right text-amber-700 dark:text-amber-400">
                      ({formatVND(pitAnnual)})
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                      Trừ từ lương NV → nộp TCQ. Đ.25 TT 111/2013
                    </td>
                  </tr>
                ) : (
                  <tr className="border-t border-border/40">
                    <td className="px-4 py-2.5 text-muted-foreground">TNCN</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">—</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">—</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                      Lương &lt; 2 tr/lần → miễn khấu trừ
                    </td>
                  </tr>
                )}

                {/* Insurance rows (HĐ lao động only) */}
                {contractType === "hdld" && (
                  <>
                    <tr className="border-t border-border/40 bg-blue-50/50 dark:bg-blue-950/10">
                      <td className="px-4 py-2.5 font-medium text-blue-800 dark:text-blue-300">
                        BHXH/BHYT/BHTN — Chủ sử dụng (21.5%)
                      </td>
                      <td className="px-4 py-2.5 text-right text-blue-700 dark:text-blue-400">
                        +{formatVND(employerInsPerMonth)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-blue-700 dark:text-blue-400">
                        +{formatVND(employerInsPerMonth * 12)}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                        Công ty đóng thêm. BH 17.5%+YT 3%+TN 1% × lương tối thiểu vùng 6tr
                      </td>
                    </tr>
                    <tr className="border-t border-border/40">
                      <td className="px-4 py-2.5 text-muted-foreground">
                        BHXH/BHYT/BHTN — Người lao động (10.5%)
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">
                        ({formatVND(employeeInsPerMonth)})
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">
                        ({formatVND(employeeInsPerMonth * 12)})
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                        Trừ từ lương NV. BH 8%+YT 1.5%+TN 1% × lương tối thiểu vùng 6tr
                      </td>
                    </tr>
                  </>
                )}

                {/* Net to employee */}
                <tr className="border-t border-border/40 bg-muted/20">
                  <td className="px-4 py-2.5 text-muted-foreground">NV thực nhận (net)</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{formatVND(netToEmployee)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{formatVND(netToEmployee * 12)}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                    Sau khấu trừ TNCN{contractType === "hdld" ? " + BHXH NV" : ""}
                  </td>
                </tr>

                {/* Total company cost */}
                <tr className="border-t-2 border-border bg-muted/40 font-bold">
                  <td className="px-4 py-2.5">Tổng công ty chi ra / người</td>
                  <td className="px-4 py-2.5 text-right">{formatVND(companyCostPerMonth)}</td>
                  <td className="px-4 py-2.5 text-right">{formatVND(companyCostAnnual)}</td>
                  <td className="px-4 py-2.5 text-xs font-normal text-muted-foreground hidden sm:table-cell">
                    = Gross{contractType === "hdld" ? " + BH chủ sử dụng" : ""} → được khấu trừ CIT
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
            <div className="text-xs text-muted-foreground mb-1">
              Tổng khấu trừ CIT / năm ({numStaff} người)
            </div>
            <div className="text-lg font-bold text-purple-700 dark:text-purple-300">
              {formatVND(totalDeductibleAnnual)}
            </div>
          </div>
          <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 p-4 text-center">
            <div className="text-xs text-muted-foreground mb-1">
              Thuế TNDN tiết kiệm ({formatPercent(corporateTaxRate)})
            </div>
            <div className="text-lg font-bold text-green-600 dark:text-green-400">
              {formatVND(citSaving)}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
            <div className="text-xs text-muted-foreground mb-1">Chi thực tế sau tiết kiệm thuế</div>
            <div className="text-lg font-bold">{formatVND(netCostAfterTax)}</div>
            <div className="text-xs text-muted-foreground">({formatVND(netCostAfterTax / 12)}/tháng)</div>
          </div>
        </div>

        {/* Legal requirements */}
        <div className="rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-3 space-y-2">
          <div className="text-xs font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Điều kiện pháp lý bắt buộc
          </div>
          {contractType === "ctv" ? (
            <ul className="space-y-1 text-xs text-blue-700 dark:text-blue-400">
              <li>• Ký hợp đồng dịch vụ cá nhân, nêu rõ phạm vi công việc, thời gian và đơn giá.</li>
              <li>• Khấu trừ TNCN 10% tại nguồn nếu thu nhập ≥ 2 triệu/lần, nộp TCQ theo tháng (Điều 25 TT 111/2013).</li>
              <li>• Chứng từ: HĐ dịch vụ + biên bản nghiệm thu công việc + lệnh chuyển khoản.</li>
              <li>• HĐ dịch vụ cá nhân không phát sinh nghĩa vụ BHXH với bên thuê.</li>
            </ul>
          ) : (
            <ul className="space-y-1 text-xs text-blue-700 dark:text-blue-400">
              <li>• Ký hợp đồng lao động xác định thời hạn, đăng ký lao động và tham gia BHXH/BHYT/BHTN.</li>
              <li>• Khấu trừ TNCN 10% tại nguồn đối với HĐ lao động dưới 3 tháng (Điều 25 TT 111/2013).</li>
              <li>• Hồ sơ: HĐ lao động + bảng lương ký tên + biên lai đóng BHXH + chứng từ chuyển khoản.</li>
              <li>• Toàn bộ lương + BHXH phần chủ sử dụng được khấu trừ CIT (Điều 4 TT 78/2014).</li>
            </ul>
          )}
        </div>

        {/* ── Nút tính tổng thể ── */}
        {baseOpt && baseOpt.scenario !== "too_high" && (
          <div className="pt-1">
            <Button
              onClick={() => setShowComprehensive(v => !v)}
              variant="outline"
              className="w-full border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {showComprehensive ? "Ẩn kết quả tổng thể" : "Tính kết quả tổng thể (Chiến thuật 1–6 + Chiến thuật 7)"}
            </Button>
          </div>
        )}

        {/* ── Bảng kết quả tổng thể ── */}
        {showComprehensive && comprehensiveResult && baseOpt && (
          <div className="rounded-lg border-2 border-purple-300 dark:border-purple-700 bg-purple-50/40 dark:bg-purple-950/10 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-purple-600 shrink-0" />
              <h3 className="text-sm font-semibold text-purple-800 dark:text-purple-300">
                Kết quả tổng hợp — Chiến thuật 1–6 kết hợp Chiến thuật 7
              </h3>
            </div>

            {/* Chi phí thực phần 7 */}
            <div className="rounded-md border border-amber-200 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/20 p-3 space-y-1.5">
              <div className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wide">
                Chi phí THỰC phát sinh từ Chiến thuật 7 (TNCN + Bảo hiểm)
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-amber-700 dark:text-amber-400">
                <span>Lương gross ({numStaff} người)</span>
                <span className="text-right font-medium text-muted-foreground italic">
                  {formatVND(monthlyGross * 12 * numStaff)}/năm — chỉ hợp thức hóa, không vào chi phí
                </span>
                {hasPIT && (
                  <>
                    <span>Khấu trừ TNCN 10%</span>
                    <span className="text-right font-semibold">{formatVND(tncnAnnual)}/năm</span>
                  </>
                )}
                {contractType === "hdld" && (
                  <>
                    <span>BHXH + BHYT + BHTN (32% lương tối thiểu vùng 6tr)</span>
                    <span className="text-right font-semibold">{formatVND(insuranceAnnual)}/năm</span>
                  </>
                )}
                <span className="font-bold text-amber-800 dark:text-amber-300">Tổng chi phí thực / năm</span>
                <span className="text-right font-bold text-amber-800 dark:text-amber-300">{formatVND(section7RealCost)}</span>
              </div>
            </div>

            {/* Bảng đối chiếu tổng thể */}
            <Card>
              <CardHeader className="pb-2 border-b">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Bảng đối chiếu: Trước → Sau CT 1–6 → Sau CT 1–6 + CT 7
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="px-4 py-2 text-xs font-medium text-muted-foreground text-left">Chỉ tiêu</th>
                      <th className="px-4 py-2 text-xs font-medium text-muted-foreground text-right">Ban đầu</th>
                      <th className="px-4 py-2 text-xs font-medium text-muted-foreground text-right">Sau CT 1–6</th>
                      <th className="px-4 py-2 text-xs font-medium text-muted-foreground text-right">Sau CT 1–6 + 7</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-border/40">
                      <td className="px-4 py-2.5 font-medium">Chi phí hợp thức hóa thêm</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">—</td>
                      <td className="px-4 py-2.5 text-right">{formatVND(baseOpt.requiredAdditionalCost)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-purple-700 dark:text-purple-300">{formatVND(comprehensiveResult.combinedDeductible)}</td>
                    </tr>
                    <tr className="border-t border-border/40">
                      <td className="px-4 py-2.5 font-medium">Lãi gộp chịu thuế TNDN</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{formatVND(baseOpt.currentTaxableIncome)}</td>
                      <td className="px-4 py-2.5 text-right">{formatVND(baseOpt.afterOptimizeTaxableIncome)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{formatVND(comprehensiveResult.newTaxableIncome)}</td>
                    </tr>
                    <tr className="border-t border-border/40 bg-red-50/30 dark:bg-red-950/10">
                      <td className="px-4 py-2.5 font-medium text-red-700 dark:text-red-400">Thuế TNDN phải nộp</td>
                      <td className="px-4 py-2.5 text-right text-red-600">{formatVND(baseOpt.currentCorporateTax)}</td>
                      <td className="px-4 py-2.5 text-right text-red-600">{formatVND(baseOpt.afterOptimizeCorporateTax)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-red-600">{formatVND(comprehensiveResult.newCIT)}</td>
                    </tr>
                    <tr className="border-t border-border/40 bg-green-50/30 dark:bg-green-950/10">
                      <td className="px-4 py-2.5 font-medium text-green-700 dark:text-green-400">Thuế TNDN tiết kiệm</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">—</td>
                      <td className="px-4 py-2.5 text-right text-green-600">{formatVND(baseOpt.taxSaving)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-green-600">{formatVND(comprehensiveResult.totalCITSaved)}</td>
                    </tr>
                    <tr className="border-t border-border/40">
                      <td className="px-4 py-2.5 font-medium">Chi phí thực CT 7 (TNCN + BH)</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">—</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">—</td>
                      <td className="px-4 py-2.5 text-right text-amber-600 font-semibold">({formatVND(section7RealCost)})</td>
                    </tr>
                    <tr className="border-t-2 border-border bg-muted/40">
                      <td className="px-4 py-2.5 font-bold">Lãi ròng / năm</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{formatVND(baseOpt.currentNetProfit)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-green-600">{formatVND(baseOpt.afterOptimizeNetProfit)}</td>
                      <td className={`px-4 py-2.5 text-right font-bold text-lg ${comprehensiveResult.finalNetProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {formatVND(comprehensiveResult.finalNetProfit)}
                      </td>
                    </tr>
                    <tr className="border-t border-border/40">
                      <td className="px-4 py-2.5 text-muted-foreground">Lãi ròng / tháng</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{formatVND(baseOpt.currentNetProfitMonthly)}</td>
                      <td className="px-4 py-2.5 text-right">{formatVND(baseOpt.afterOptimizeNetProfitMonthly)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{formatVND(comprehensiveResult.finalNetProfitMonthly)}</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground italic">
              * Lương gross Chiến thuật 7 ({formatVND(monthlyGross * 12 * numStaff)}/năm) chỉ dùng để hợp thức hóa giảm lãi gộp chịu thuế, không tính vào chi phí thực của doanh nghiệp.
              Chi phí thực bao gồm: TNCN {hasPIT ? `(${formatVND(tncnAnnual)})` : "(0)"}{contractType === "hdld" ? ` + BHXH/BHYT/BHTN (${formatVND(insuranceAnnual)})` : ""}.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Allocation default ────────────────────────────────────────────────────────
const DEFAULT_ALLOC_L1: CostAllocation = { training: 20, equipment: 25, office: 15, consultants: 20, marketing: 10, other: 10 };
const DEFAULT_ALLOC_L2: CostAllocation = { training: 20, equipment: 25, office: 15, consultants: 25, marketing: 10, other: 5 };

// ── Main Component ─────────────────────────────────────────────────────────────
export default function OptimizePage() {
  const { input, result: calcResult } = useFinancial();
  const { toast } = useToast();
  const optimizeMutation = useOptimize();

  const [targetProfitPct, setTargetProfitPct] = useState<number>(10);
  const [optResult, setOptResult] = useState<{ type1: OptimizeContractResult; type2: OptimizeContractResult } | null>(null);
  const [activeTab, setActiveTab] = useState<"type1" | "type2">("type1");

  const revenue = calcResult?.totalRevenue ?? 0;
  const targetProfit = (targetProfitPct / 100) * revenue;

  const handleOptimize = () => {
    if (!calcResult) {
      toast({ title: "Chưa có dữ liệu", description: "Vui lòng tính toán thông số cơ bản trước.", variant: "destructive" });
      return;
    }
    optimizeMutation.mutate(
      { data: { financialInput: input, targetNetProfit: targetProfit, allocationL1: DEFAULT_ALLOC_L1, allocationL2: DEFAULT_ALLOC_L2 } },
      {
        onSuccess: (res) => {
          setOptResult(res);
          toast({ title: "Phân tích hoàn tất", description: "Đã tạo phương án giảm thuế TNDN." });
        },
        onError: () => {
          toast({ title: "Lỗi", description: "Không thể tính toán.", variant: "destructive" });
        },
      }
    );
  };

  if (!calcResult) {
    return (
      <div className="p-6 max-w-[1000px] mx-auto pb-16 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <TrendingDown className="w-16 h-16 text-muted-foreground/30 mb-6" />
        <h2 className="text-2xl font-bold mb-2">Cần tính toán cơ sở trước</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Bạn phải nhập thông số và chạy tính toán trước khi xem tối ưu thuế TNDN.
        </p>
        <Link href="/input">
          <div className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2.5 rounded-md font-medium cursor-pointer transition-colors">
            Nhập thông số ngay
          </div>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1100px] mx-auto pb-16">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Tối ưu thuế TNDN</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Vai trò kế toán 10 năm kinh nghiệm — hợp thức hóa chi phí đầu vào để giảm số thuế phải nộp, đạt lãi ròng mục tiêu
        </p>
      </div>

      {/* Control strip */}
      <Card className="mb-6">
        <CardContent className="pt-5 pb-5">
          <div className="flex flex-wrap items-end gap-5">
            <div className="space-y-1.5 min-w-[260px]">
              <Label>Lãi ròng kỳ vọng (% doanh thu)</Label>
              <div className="flex items-center gap-2">
                <div className="relative max-w-[140px]">
                  <Input
                    type="number"
                    step={0.5}
                    min={0}
                    max={100}
                    value={targetProfitPct}
                    onChange={e => setTargetProfitPct(Number(e.target.value))}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">%</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  = {formatVND(targetProfit)}/năm
                </span>
              </div>
              <div className="text-xs text-muted-foreground space-x-3">
                <span>
                  Biên hiện tại — L1:{" "}
                  <span className={calcResult.type1.netMargin >= 0 ? "text-green-600" : "text-red-600"}>
                    {formatPercent(calcResult.type1.netMargin)}
                  </span>
                </span>
                <span>
                  L2:{" "}
                  <span className={calcResult.type2.netMargin >= 0 ? "text-green-600" : "text-red-600"}>
                    {formatPercent(calcResult.type2.netMargin)}
                  </span>
                </span>
              </div>
            </div>

            <Button
              onClick={handleOptimize}
              className="h-10 px-6"
              disabled={optimizeMutation.isPending}
            >
              {optimizeMutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Đang phân tích...</>
                : <><TrendingDown className="w-4 h-4 mr-2" />Tính phương án giảm thuế</>
              }
            </Button>

            {optResult && (
              <p className="text-xs text-muted-foreground italic">
                * Phân bổ 6 khoản mặc định: Đào tạo 20% · Thiết bị 25% · Văn phòng 15% · CTV 20–25% · Marketing 10% · Dự phòng 5–10%
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {optResult ? (
        <div className="space-y-5">
          {/* Tab selector */}
          <div className="flex gap-2">
            {(["type1", "type2"] as const).map(t => {
              const d = optResult[t];
              const isFeasible = d.scenario !== "too_high";
              return (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium border transition-colors flex items-center justify-center gap-2 ${
                    activeTab === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t === "type1" ? "Hợp đồng Loại 1" : "Hợp đồng Loại 2"}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-1 ${
                    isFeasible
                      ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                      : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                  }`}>
                    {isFeasible ? "✓ Khả thi" : "⚠ Kỳ vọng quá cao"}
                  </span>
                </button>
              );
            })}
          </div>

          <ContractOptimizeResult
            d={optResult[activeTab]}
            label={activeTab === "type1" ? "Hợp đồng Loại 1 — Chỉ lấy việc" : "Hợp đồng Loại 2 — Lo trọn gói"}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-muted/10 flex flex-col items-center justify-center py-20 text-center">
          <TrendingDown className="w-12 h-12 text-muted-foreground/20 mb-4" />
          <h3 className="text-base font-semibold text-muted-foreground mb-1">Chưa có phân tích</h3>
          <p className="text-sm text-muted-foreground/70 max-w-sm">
            Nhập lãi ròng kỳ vọng rồi nhấn <strong>"Tính phương án giảm thuế"</strong>.
          </p>
        </div>
      )}

      {/* Chiến thuật 7 — always visible once base calc exists */}
      <div className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2">
            Chiến thuật bổ sung — Chi phí nhân sự thuê ngoài
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <OutsourcedStaffCard
          corporateTaxRate={input.corporateTaxRate}
          optResult={optResult}
          activeTab={activeTab}
        />
      </div>
    </div>
  );
}

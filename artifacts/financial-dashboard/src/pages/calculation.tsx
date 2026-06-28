import { useFinancial } from "@/context/FinancialContext";
import { Card } from "@/components/ui/card";
import { formatVND, formatPercent } from "@/lib/utils";
import { Link } from "wouter";
import { AlertTriangle, Info, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";

export default function CalculationPage() {
  const { input, result } = useFinancial();

  if (!result) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-12 text-center">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-6">
          <span className="text-2xl text-muted-foreground">?</span>
        </div>
        <h2 className="text-2xl font-bold mb-2">Chưa có kết quả</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Bạn cần nhập thông số và chạy tính toán trước khi xem tính toán trung gian.
        </p>
        <Link href="/input">
          <div className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2.5 rounded-md font-medium cursor-pointer transition-colors">
            Nhập thông số ngay
          </div>
        </Link>
      </div>
    );
  }

  const t1 = result.type1;
  const t2 = result.type2;
  const deductibleRate = input.fixedCostDeductibleRate ?? 0.8;

  // ── Derived intermediary values ──────────────────────────────────────────
  const directorWageAnnual = input.directorSalaryMonthly * 12;
  const accountantWageAnnual = input.accountantSalaryMonthly * 12;
  const technicianWageAnnual = input.numTechnicians * input.technicianSalaryMonthly * 12;

  const insuranceL1 = (directorWageAnnual + accountantWageAnnual) * input.insuranceRate;
  const insuranceL2 =
    (directorWageAnnual + accountantWageAnnual + technicianWageAnnual) * input.insuranceRate;

  const officeAnnual = input.officeRentMonthly * 12;
  const travelAnnual = input.travelEntertainMonthly * 12;
  const otherAnnual = input.otherCostMonthly * 12;

  const signingDeductibleL1 = t1.signingCost * 0.9;
  const signingDeductibleL2 = t2.signingCost * 0.9;
  const fixedDeductibleCIT = t1.fixedCost * 0.9;
  const vatInAmount = t1.fixedCost * input.vatRate * deductibleRate;

  const wageFundLimit = t2.wageFundLimit;
  const wageFundUsed = t2.wageFundUsed;
  const wageFundRemaining = t2.wageFundRemaining;
  const wageFundExceeded = t2.wageFundExceeded;
  const maxTechniciansAllowed = t2.maxTechniciansAllowed;
  const technicianWageRatio = t2.technicianWageRatio;

  const totalWithVatL1 = t1.revenue + t1.vatOut;
  const totalWithVatL2 = t2.revenue + t2.vatOut;

  // ── Breakeven chart data ────────────────────────────────────────────────
  const chartData = (() => {
    const maxR = Math.max(t1.revenue, t2.revenue) * 2;
    const POINTS = 60;
    const k1 = input.kickbackRateType1;
    const k2 = input.kickbackRateType2;
    const s1 = input.signingCostRateType1;
    const s2 = input.signingCostRateType2;
    const t = input.corporateTaxRate;
    const F = t1.fixedCost;
    const L1 = t1.laborCost;
    const L2 = t2.laborCost;
    const vi = t1.vatIn; // vatIn is constant (based on fixedCost)

    return Array.from({ length: POINTS + 1 }, (_, i) => {
      const R = (maxR / POINTS) * i;

      // Type 1
      const signing1 = R * s1;
      const taxable1 = Math.max(0, R - L1 - F * 0.9 - signing1 * 0.9);
      const tax1 = taxable1 * t;
      const cf1 = R * (1 - k1 - s1) - L1 - F;
      const np1 = cf1 - tax1 + vi;

      // Type 2
      const signing2 = R * s2;
      const taxable2 = Math.max(0, R - L2 - F * 0.9 - signing2 * 0.9);
      const tax2 = taxable2 * t;
      const cf2 = R * (1 - k2 - s2) - L2 - F;
      const np2 = cf2 - tax2 + vi;

      return { R, np1, np2 };
    });
  })();

  const fmtBillion = (v: number) => {
    if (Math.abs(v) >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}tỷ`;
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}tr`;
    return formatVND(v);
  };

  const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (!active || !payload?.length) return null;
    const np1val = payload.find((p) => p.dataKey === "np1")?.value ?? 0;
    const np2val = payload.find((p) => p.dataKey === "np2")?.value ?? 0;
    return (
      <div className="bg-card border border-border rounded-md shadow-lg p-3 text-xs min-w-[180px]">
        <p className="font-semibold text-foreground mb-1.5">
          DT: {fmtBillion(label as number)}
        </p>
        <div className="space-y-1">
          <div className="flex justify-between gap-4">
            <span className="text-blue-600">Loại 1:</span>
            <span className={`font-medium ${np1val < 0 ? "text-red-500" : "text-green-600"}`}>
              {fmtBillion(np1val as number)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-violet-600">Loại 2:</span>
            <span className={`font-medium ${np2val < 0 ? "text-red-500" : "text-green-600"}`}>
              {fmtBillion(np2val as number)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // ── UI helpers ──────────────────────────────────────────────────────────
  const SectionHeader = ({
    label,
    sub,
    color = "default",
  }: {
    label: string;
    sub?: string;
    color?: "default" | "blue" | "amber" | "green" | "red" | "violet";
  }) => {
    const styles: Record<string, string> = {
      default:
        "bg-muted/20 text-muted-foreground border-muted/30",
      blue:
        "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
      amber:
        "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
      green:
        "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
      red:
        "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
      violet:
        "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800",
    };
    return (
      <div
        className={`py-2.5 pl-4 border-b font-semibold text-xs uppercase tracking-wider ${styles[color]}`}
      >
        {label}
        {sub && (
          <span className="block text-[10px] font-normal normal-case tracking-normal opacity-70 mt-0.5">
            {sub}
          </span>
        )}
      </div>
    );
  };

  type CellVariant = "normal" | "bold" | "total" | "warning";

  const Row = ({
    label,
    v1,
    v2,
    note,
    variant = "normal",
    fmt = "currency",
    onlyL2 = false,
    indent = false,
    tag,
  }: {
    label: string;
    v1?: number;
    v2?: number;
    note?: string;
    variant?: CellVariant;
    fmt?: "currency" | "percent" | "integer" | "rate";
    onlyL2?: boolean;
    indent?: boolean;
    tag?: string;
  }) => {
    const isTotal = variant === "total";
    const isBold = variant === "bold" || isTotal;

    const rowBg = isTotal ? "bg-muted/30" : variant === "warning" ? "bg-amber-50/50 dark:bg-amber-950/10" : "";
    const labelCls = isBold ? "font-semibold text-foreground" : "text-muted-foreground";

    const formatVal = (v: number) => {
      if (fmt === "percent") return formatPercent(v);
      if (fmt === "integer") return v.toLocaleString("vi-VN");
      if (fmt === "rate") return `${(v * 100).toFixed(2)}%`;
      return formatVND(v);
    };

    const valCls = (v?: number) => {
      if (v === undefined) return "text-muted-foreground/40";
      const base = isBold ? "font-bold" : "";
      if (v < 0) return `${base} text-red-600 dark:text-red-400`;
      if (variant === "warning") return `${base} text-amber-600 dark:text-amber-500`;
      return base;
    };

    return (
      <div
        className={`grid grid-cols-[1fr_164px_164px] py-2.5 text-sm border-b border-border/30 ${rowBg}`}
      >
        <div className={`${indent ? "pl-8" : "pl-4"} pr-2 ${labelCls} leading-snug`}>
          {label}
          {tag && (
            <span className="ml-2 px-1.5 py-0.5 text-[9px] font-medium rounded bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 uppercase tracking-wide">
              {tag}
            </span>
          )}
          {note && (
            <span className="block text-[10px] text-muted-foreground/60 font-normal mt-0.5">
              {note}
            </span>
          )}
        </div>
        <div className={`text-right pr-6 tabular-nums ${valCls(v1)}`}>
          {onlyL2 ? (
            <span className="text-muted-foreground/30">—</span>
          ) : v1 !== undefined ? (
            formatVal(v1)
          ) : (
            <span className="text-muted-foreground/30">—</span>
          )}
        </div>
        <div className={`text-right pr-6 tabular-nums border-l border-border/40 ${valCls(v2)}`}>
          {v2 !== undefined ? formatVal(v2) : <span className="text-muted-foreground/30">—</span>}
        </div>
      </div>
    );
  };

  const Divider = () => <div className="h-2 bg-muted/5 border-b border-border/20" />;

  return (
    <div className="p-6 max-w-[1020px] mx-auto min-h-full pb-20">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Tính Toán Trung Gian</h1>
        <p className="text-muted-foreground mt-1">
          BẢNG CHI TIẾT — Đầy đủ các bước tính toán Loại 1 và Loại 2
        </p>
      </div>

      {/* Warnings */}
      {(wageFundExceeded || !t2.isViable || !t1.isViable) && (
        <div className="mb-4 space-y-2">
          {wageFundExceeded && (
            <div className="flex items-start gap-3 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                <strong>Quỹ lương Loại 2 vượt giới hạn:</strong> Chi phí kỹ sư (
                {formatVND(wageFundUsed)}) vượt {(input.maxWageFundRate ?? 0.15) * 100}% doanh thu (
                {formatVND(wageFundLimit)}). Tối đa {maxTechniciansAllowed} kỹ sư được phép.
              </span>
            </div>
          )}
          {!t1.isViable && (
            <div className="flex items-start gap-3 p-3 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm text-red-800 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                <strong>Loại 1 đang lỗ:</strong> Lãi ròng {formatVND(t1.netProfit)}. Cần giảm tỷ
                lệ cắt lại hoặc tăng doanh thu.
              </span>
            </div>
          )}
          {!t2.isViable && (
            <div className="flex items-start gap-3 p-3 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm text-red-800 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                <strong>Loại 2 đang lỗ:</strong> Lãi ròng {formatVND(t2.netProfit)}. Cần xem lại
                chi phí kỹ sư hoặc tỷ lệ cắt lại.
              </span>
            </div>
          )}
        </div>
      )}

      <Card className="overflow-hidden">
        {/* Column header */}
        <div className="grid grid-cols-[1fr_164px_164px] bg-muted py-3 border-b border-border font-semibold text-sm sticky top-0 z-10">
          <div className="pl-4 text-foreground">Chỉ tiêu tính toán</div>
          <div className="text-right pr-6 text-foreground">Loại 1</div>
          <div className="text-right pr-6 border-l border-border text-foreground">Loại 2</div>
        </div>

        <div className="bg-card">
          {/* ① DOANH THU */}
          <SectionHeader label="① Doanh thu tư vấn" color="blue" />
          <Row
            label="Doanh thu giám sát công trình"
            v1={result.supervisionRevenue}
            v2={result.supervisionRevenue}
            note={`Giá trị công trình × tỷ lệ giám sát ${formatPercent(input.supervisionRate)}`}
            indent
          />
          <Row
            label="Doanh thu thiết kế công trình"
            v1={result.designRevenue}
            v2={result.designRevenue}
            note={`Giá trị công trình × tỷ lệ thiết kế ${formatPercent(input.designRate)}`}
            indent
          />
          <Row
            label="Tổng doanh thu tư vấn (chưa VAT)"
            v1={t1.revenue}
            v2={t2.revenue}
            variant="total"
          />

          <Divider />

          {/* ② CẮT LẠI */}
          <SectionHeader
            label="② Chi phí cắt lại cho chủ đầu tư"
            sub="Không được khấu trừ thuế TNDN — khoản chi ra ngoài sổ sách"
            color="red"
          />
          <Row
            label="Tỷ lệ cắt lại"
            v1={input.kickbackRateType1}
            v2={input.kickbackRateType2}
            fmt="rate"
            note="Loại 1 thường cao hơn vì không phải lo thêm kỹ sư"
            indent
          />
          <Row
            label="Số tiền cắt lại (dòng tiền ra thực tế)"
            v1={t1.kickback}
            v2={t2.kickback}
            variant="bold"
            note="Doanh thu × tỷ lệ cắt lại"
            indent
          />
          <Row
            label="Doanh thu còn lại sau cắt lại"
            v1={t1.revenue - t1.kickback}
            v2={t2.revenue - t2.kickback}
            variant="total"
            note="Phần doanh thu thực sự thuộc về công ty"
          />

          <Divider />

          {/* ③ CHI PHÍ CỐ ĐỊNH */}
          <SectionHeader
            label="③ Chi phí cố định chung"
            sub="Như nhau ở cả 2 loại hợp đồng"
            color="default"
          />
          <Row
            label="Thuê văn phòng"
            v1={officeAnnual}
            v2={officeAnnual}
            note={`${formatVND(input.officeRentMonthly)}/tháng × 12`}
            indent
          />
          <Row
            label="Đi lại & tiếp khách"
            v1={travelAnnual}
            v2={travelAnnual}
            note={`${formatVND(input.travelEntertainMonthly)}/tháng × 12`}
            indent
          />
          <Row
            label="Chi phí khác"
            v1={otherAnnual}
            v2={otherAnnual}
            note={`${formatVND(input.otherCostMonthly)}/tháng × 12`}
            indent
          />
          <Row
            label="Tổng chi phí cố định thực chi"
            v1={t1.fixedCost}
            v2={t2.fixedCost}
            variant="bold"
          />
          <Row
            label="Phần được khấu trừ thuế TNDN (90%)"
            v1={fixedDeductibleCIT}
            v2={fixedDeductibleCIT}
            note="90% chi phí có chứng từ hợp lệ"
            indent
          />
          <Row
            label="VAT đầu vào được khấu trừ"
            v1={vatInAmount}
            v2={vatInAmount}
            note={`${(deductibleRate * 100).toFixed(0)}% chi phí cố định × ${(input.vatRate * 100).toFixed(0)}% VAT`}
            indent
          />

          <Divider />

          {/* ④ LAO ĐỘNG */}
          <SectionHeader
            label="④ Chi phí lao động trực tiếp"
            sub="Loại 2 có thêm lương kỹ sư — được khấu trừ 100% thuế TNDN"
            color="default"
          />
          <Row
            label="Lương giám đốc (cả năm)"
            v1={directorWageAnnual}
            v2={directorWageAnnual}
            note={`${formatVND(input.directorSalaryMonthly)}/tháng × 12`}
            indent
          />
          <Row
            label="Lương kế toán (cả năm)"
            v1={accountantWageAnnual}
            v2={accountantWageAnnual}
            note={`${formatVND(input.accountantSalaryMonthly)}/tháng × 12`}
            indent
          />
          <Row
            label="Lương kỹ sư (cả năm)"
            v2={technicianWageAnnual}
            note={`${input.numTechnicians} người × ${formatVND(input.technicianSalaryMonthly)}/tháng × 12`}
            tag="Chỉ Loại 2"
            onlyL2
            indent
          />
          <Row
            label="Bảo hiểm xã hội & y tế"
            v1={insuranceL1}
            v2={insuranceL2}
            note={`${(input.insuranceRate * 100).toFixed(1)}% × tổng lương chịu bảo hiểm`}
            indent
          />
          <Row
            label="Tổng chi phí lao động (gồm bảo hiểm)"
            v1={t1.laborCost}
            v2={t2.laborCost}
            variant="total"
            note="100% được khấu trừ thuế TNDN"
          />
          <Row
            label="Chi phí lao động / Doanh thu"
            v1={t1.revenue > 0 ? t1.laborCost / t1.revenue : 0}
            v2={t2.revenue > 0 ? t2.laborCost / t2.revenue : 0}
            fmt="percent"
            indent
          />

          <Divider />

          {/* ⑤ QUỸ LƯƠNG (CHỈ LOẠI 2) */}
          <SectionHeader
            label="⑤ Phân tích quỹ lương kỹ sư"
            sub={`Đặc thù Loại 2 — giới hạn tối đa ${(input.maxWageFundRate ?? 0.15) * 100}% doanh thu để an toàn thuế`}
            color="violet"
          />
          <Row
            label="Giới hạn quỹ lương kỹ sư (tối đa)"
            v2={wageFundLimit}
            note={`${((input.maxWageFundRate ?? 0.15) * 100).toFixed(0)}% × doanh thu — ngưỡng nội bộ phòng rủi ro thuế`}
            tag="Chỉ Loại 2"
            onlyL2
            indent
          />
          <Row
            label="Quỹ lương kỹ sư thực dùng (gồm BH)"
            v2={wageFundUsed}
            note={`${input.numTechnicians} Kỹ sư × ${formatVND(input.technicianSalaryMonthly)}/tháng × 12 × (1 + ${(input.insuranceRate * 100).toFixed(1)}% BH)`}
            tag="Chỉ Loại 2"
            onlyL2
            indent
          />
          <Row
            label={wageFundExceeded ? "Quỹ lương VƯỢT giới hạn ⚠" : "Quỹ lương còn dư"}
            v2={Math.abs(wageFundRemaining)}
            variant={wageFundExceeded ? "warning" : "normal"}
            note={
              wageFundExceeded
                ? `Vượt ${formatVND(Math.abs(wageFundRemaining))} — rủi ro bị loại trừ chi phí khi quyết toán thuế`
                : "Còn dư — có thể tuyển thêm kỹ sư"
            }
            tag="Chỉ Loại 2"
            onlyL2
            indent
          />
          <Row
            label="Số kỹ sư tối đa được phép"
            v2={maxTechniciansAllowed}
            fmt="integer"
            note={`Với lương ${formatVND(input.technicianSalaryMonthly)}/tháng, tối đa ${maxTechniciansAllowed} người trong giới hạn quỹ lương`}
            tag="Chỉ Loại 2"
            onlyL2
            indent
          />
          <Row
            label="Tỷ lệ lương kỹ sư / Doanh thu"
            v2={technicianWageRatio}
            fmt="percent"
            variant={technicianWageRatio > (input.maxWageFundRate ?? 0.15) ? "warning" : "normal"}
            note={
              technicianWageRatio > (input.maxWageFundRate ?? 0.15)
                ? `Vượt ngưỡng ${((input.maxWageFundRate ?? 0.15) * 100).toFixed(0)}% an toàn — cần xem xét lại`
                : `Trong ngưỡng ${((input.maxWageFundRate ?? 0.15) * 100).toFixed(0)}% an toàn`
            }
            tag="Chỉ Loại 2"
            onlyL2
            indent
          />
          <Row
            label="Loại 2 có thêm chi phí lao động so với Loại 1"
            v2={t2.laborCost - t1.laborCost}
            note="Phần tăng thêm từ kỹ sư + bảo hiểm — được khấu trừ thuế TNDN"
            tag="Chỉ Loại 2"
            onlyL2
            indent
          />

          <Divider />

          {/* ⑥ KÝ HỒ SƠ */}
          <SectionHeader
            label="⑥ Chi phí ký hồ sơ / trung gian"
            sub="Loại 2 thấp hơn do đã giảm tỷ lệ cắt lại — 90% được khấu trừ thuế TNDN"
            color="default"
          />
          <Row
            label="Tỷ lệ chi phí ký hồ sơ"
            v1={input.signingCostRateType1}
            v2={input.signingCostRateType2}
            fmt="rate"
            indent
          />
          <Row
            label="Chi phí ký hồ sơ thực chi"
            v1={t1.signingCost}
            v2={t2.signingCost}
            variant="bold"
            note="Doanh thu × tỷ lệ ký hồ sơ"
            indent
          />
          <Row
            label="Phần được khấu trừ thuế TNDN (90%)"
            v1={signingDeductibleL1}
            v2={signingDeductibleL2}
            note="Theo TT 78/2014/TT-BTC"
            indent
          />
          <Row
            label="Phần không được khấu trừ (10%)"
            v1={t1.signingCost * 0.1}
            v2={t2.signingCost * 0.1}
            note="Cần ghi nhận khi lập kế hoạch tài chính"
            indent
          />

          <Divider />

          {/* ⑦ VAT */}
          <SectionHeader label="⑦ VAT & dòng tiền với khách hàng" color="blue" />
          <Row
            label="VAT đầu ra phải thu từ khách hàng"
            v1={t1.vatOut}
            v2={t2.vatOut}
            note={`${(input.vatRate * 100).toFixed(0)}% × doanh thu chưa VAT`}
            indent
          />
          <Row
            label="Tổng tiền khách hàng thanh toán (gồm VAT)"
            v1={totalWithVatL1}
            v2={totalWithVatL2}
            variant="total"
          />
          <Row
            label="VAT đầu vào được khấu trừ"
            v1={t1.vatIn}
            v2={t2.vatIn}
            note={`${(deductibleRate * 100).toFixed(0)}% chi phí cố định × ${(input.vatRate * 100).toFixed(0)}% VAT`}
            indent
          />
          <Row
            label="VAT phải nộp ngân sách"
            v1={t1.vatDue}
            v2={t2.vatDue}
            variant="bold"
            note="VAT đầu ra − VAT đầu vào được khấu trừ"
          />

          <Divider />

          {/* ⑧ DÒNG TIỀN TRƯỚC THUẾ */}
          <SectionHeader
            label="⑧ Dòng tiền trước thuế TNDN"
            sub="Doanh thu − Cắt lại − Lao động − CP cố định − Ký hồ sơ"
            color="amber"
          />
          <Row label="(+) Doanh thu tư vấn" v1={t1.revenue} v2={t2.revenue} indent />
          <Row
            label="(−) Chi phí cắt lại CĐT"
            v1={-t1.kickback}
            v2={-t2.kickback}
            note="Không được khấu trừ thuế TNDN"
            indent
          />
          <Row
            label="(−) Chi phí lao động trực tiếp"
            v1={-t1.laborCost}
            v2={-t2.laborCost}
            indent
          />
          <Row
            label="(−) Chi phí cố định thực chi"
            v1={-t1.fixedCost}
            v2={-t2.fixedCost}
            indent
          />
          <Row
            label="(−) Chi phí ký hồ sơ"
            v1={-t1.signingCost}
            v2={-t2.signingCost}
            indent
          />
          <Row
            label="Dòng tiền trước thuế TNDN"
            v1={t1.cashFlowBeforeTax}
            v2={t2.cashFlowBeforeTax}
            variant="total"
            note="Lãi trước thuế theo dòng tiền thực tế"
          />

          <Divider />

          {/* ⑨ THUẾ TNDN */}
          <SectionHeader
            label="⑨ Thuế thu nhập doanh nghiệp (TNDN)"
            sub={`Thuế suất ${(input.corporateTaxRate * 100).toFixed(0)}% — tính trên thu nhập chịu thuế (không trừ cắt lại)`}
            color="blue"
          />
          <Row label="(+) Doanh thu chịu thuế" v1={t1.revenue} v2={t2.revenue} indent />
          <Row
            label="(−) Chi phí lao động được khấu trừ"
            v1={-t1.laborCost}
            v2={-t2.laborCost}
            indent
          />
          <Row
            label="(−) Chi phí cố định được khấu trừ (90%)"
            v1={-fixedDeductibleCIT}
            v2={-fixedDeductibleCIT}
            note="90% × chi phí cố định có chứng từ"
            indent
          />
          <Row
            label="(−) Chi phí ký hồ sơ được khấu trừ (90%)"
            v1={-signingDeductibleL1}
            v2={-signingDeductibleL2}
            note="90% × chi phí ký hồ sơ (TT 78/2014)"
            indent
          />
          <Row
            label="Thu nhập chịu thuế TNDN"
            v1={t1.taxableIncome}
            v2={t2.taxableIncome}
            variant="bold"
            note="Lưu ý: cắt lại CĐT KHÔNG được khấu trừ ở bước này"
          />
          <Row
            label={`Thuế TNDN phải nộp (${(input.corporateTaxRate * 100).toFixed(0)}%)`}
            v1={t1.corporateTax}
            v2={t2.corporateTax}
            variant="total"
          />
          <Row
            label="Thuế TNDN / Doanh thu"
            v1={t1.revenue > 0 ? t1.corporateTax / t1.revenue : 0}
            v2={t2.revenue > 0 ? t2.corporateTax / t2.revenue : 0}
            fmt="percent"
            indent
          />
          <Row
            label="Loại 2 tiết kiệm thuế TNDN so với Loại 1"
            v2={Math.max(0, t1.corporateTax - t2.corporateTax)}
            note="Nhờ chi phí lao động kỹ sư cao hơn — đây là lợi thế chính của Loại 2"
            tag="Chỉ Loại 2"
            onlyL2
            indent
          />

          <Divider />

          {/* ⑩ LÃI RÒNG */}
          <SectionHeader
            label="⑩ Lãi ròng sau thuế TNDN"
            sub="Kết quả cuối cùng — số tiền thực sự còn lại cho công ty"
            color="green"
          />
          <Row
            label="Dòng tiền trước thuế TNDN"
            v1={t1.cashFlowBeforeTax}
            v2={t2.cashFlowBeforeTax}
            indent
          />
          <Row
            label="(−) Thuế TNDN phải nộp"
            v1={-t1.corporateTax}
            v2={-t2.corporateTax}
            indent
          />
          <Row
            label="(+) VAT đầu vào đã trả nhà cung cấp"
            v1={t1.vatIn}
            v2={t2.vatIn}
            note="VAT đã gộp vào chi phí cố định — cộng lại vì không phải chi phí thực"
            indent
          />
          <Row
            label="Lãi ròng sau thuế TNDN"
            v1={t1.netProfit}
            v2={t2.netProfit}
            variant="total"
            note={
              t2.netProfit > t1.netProfit
                ? "✓ Loại 2 có lãi ròng cao hơn"
                : "✓ Loại 1 có lãi ròng cao hơn"
            }
          />
          <Row
            label="Lãi ròng bình quân mỗi tháng"
            v1={t1.netProfitMonthly}
            v2={t2.netProfitMonthly}
            variant="bold"
            indent
          />
          <Row
            label="Biên lãi ròng (Net margin)"
            v1={t1.netMargin}
            v2={t2.netMargin}
            fmt="percent"
            variant="bold"
            indent
          />
          <Row
            label="Chênh lệch lãi ròng Loại 2 so với Loại 1"
            v2={t2.netProfit - t1.netProfit}
            note={
              t2.netProfit > t1.netProfit
                ? "Loại 2 lợi hơn nhờ tiết kiệm thuế TNDN"
                : "Loại 1 lợi hơn — chi phí kỹ sư Loại 2 chưa bù được"
            }
            tag="Chỉ Loại 2"
            onlyL2
            indent
          />

          <Divider />

          {/* ⑪ HÒA VỐN */}
          <SectionHeader
            label="⑪ Phân tích điểm hòa vốn"
            sub="Doanh thu tối thiểu để không lỗ (lãi ròng = 0)"
            color="amber"
          />
          <Row
            label="Doanh thu thực tế"
            v1={t1.revenue}
            v2={t2.revenue}
            indent
          />
          <Row
            label="Doanh thu hòa vốn (break-even)"
            v1={t1.breakEvenRevenue}
            v2={t2.breakEvenRevenue}
            variant="bold"
            note="Doanh thu tối thiểu để lãi ròng = 0"
            indent
          />
          <Row
            label="Biên an toàn so với điểm hòa vốn"
            v1={t1.revenue - t1.breakEvenRevenue}
            v2={t2.revenue - t2.breakEvenRevenue}
            variant={
              t1.revenue - t1.breakEvenRevenue < 0 || t2.revenue - t2.breakEvenRevenue < 0
                ? "warning"
                : "normal"
            }
            note="Dương = có lãi, Âm = đang lỗ"
            indent
          />
          <Row
            label="Tỷ lệ doanh thu thực / hòa vốn"
            v1={t1.breakEvenRevenue > 0 ? t1.revenue / t1.breakEvenRevenue : 0}
            v2={t2.breakEvenRevenue > 0 ? t2.revenue / t2.breakEvenRevenue : 0}
            fmt="percent"
            note="> 100% = có lãi ‣ = 100% = hòa vốn ‣ < 100% = lỗ"
            indent
          />
        </div>
      </Card>

      {/* Breakeven Chart */}
      <Card className="mt-6 overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-base text-foreground">Biểu đồ Hòa vốn — Lãi ròng theo Doanh thu</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Đường cong lãi ròng của Loại 1 và Loại 2 khi doanh thu thay đổi — điểm cắt trục hoành là điểm hòa vốn
          </p>

          {/* Summary stats above chart */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="p-3 rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 text-xs">
              <div className="font-semibold text-blue-700 dark:text-blue-400 mb-1">Loại 1 — Điểm hòa vốn</div>
              <div className="text-lg font-bold text-blue-800 dark:text-blue-300">{fmtBillion(t1.breakEvenRevenue)}</div>
              <div className="text-blue-600 dark:text-blue-500 mt-0.5">
                Doanh thu hiện tại đạt {t1.breakEvenRevenue > 0 ? ((t1.revenue / t1.breakEvenRevenue) * 100).toFixed(0) : 0}% mức hòa vốn
              </div>
            </div>
            <div className="p-3 rounded-md bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 text-xs">
              <div className="font-semibold text-violet-700 dark:text-violet-400 mb-1">Loại 2 — Điểm hòa vốn</div>
              <div className="text-lg font-bold text-violet-800 dark:text-violet-300">{fmtBillion(t2.breakEvenRevenue)}</div>
              <div className="text-violet-600 dark:text-violet-500 mt-0.5">
                Doanh thu hiện tại đạt {t2.breakEvenRevenue > 0 ? ((t2.revenue / t2.breakEvenRevenue) * 100).toFixed(0) : 0}% mức hòa vốn
              </div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />

              <XAxis
                dataKey="R"
                type="number"
                domain={[0, "dataMax"]}
                tickFormatter={fmtBillion}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={false}
                label={{
                  value: "Doanh thu (VNĐ)",
                  position: "insideBottom",
                  offset: -4,
                  fontSize: 10,
                  fill: "hsl(var(--muted-foreground))",
                }}
              />

              <YAxis
                tickFormatter={fmtBillion}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={false}
                width={64}
                label={{
                  value: "Lãi ròng (VNĐ)",
                  angle: -90,
                  position: "insideLeft",
                  offset: 10,
                  fontSize: 10,
                  fill: "hsl(var(--muted-foreground))",
                }}
              />

              <Tooltip content={<CustomTooltip />} />

              <Legend
                wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }}
                formatter={(value) =>
                  value === "np1"
                    ? `Loại 1 (cắt lại ${(input.kickbackRateType1 * 100).toFixed(0)}%)`
                    : `Loại 2 (cắt lại ${(input.kickbackRateType2 * 100).toFixed(0)}%)`
                }
              />

              {/* Breakeven line at y=0 */}
              <ReferenceLine
                y={0}
                stroke="#ef4444"
                strokeDasharray="6 3"
                strokeWidth={1.5}
                label={{ value: "Hòa vốn", position: "right", fontSize: 9, fill: "#ef4444" }}
              />

              {/* Current revenue vertical line */}
              <ReferenceLine
                x={t1.revenue}
                stroke="#6b7280"
                strokeDasharray="4 4"
                strokeWidth={1}
                label={{ value: "DT hiện tại", position: "top", fontSize: 9, fill: "#6b7280" }}
              />

              {/* Breakeven points for L1 */}
              {t1.breakEvenRevenue > 0 && t1.breakEvenRevenue < Math.max(t1.revenue, t2.revenue) * 2 && (
                <ReferenceLine
                  x={t1.breakEvenRevenue}
                  stroke="#3b82f6"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                />
              )}

              {/* Breakeven points for L2 */}
              {t2.breakEvenRevenue > 0 && t2.breakEvenRevenue < Math.max(t1.revenue, t2.revenue) * 2 && (
                <ReferenceLine
                  x={t2.breakEvenRevenue}
                  stroke="#7c3aed"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                />
              )}

              <Line
                type="monotone"
                dataKey="np1"
                name="np1"
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />

              <Line
                type="monotone"
                dataKey="np2"
                name="np2"
                stroke="#7c3aed"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>

          <p className="text-[10px] text-muted-foreground/60 text-center mt-1">
            Đường đứt nét xanh/tím = điểm hòa vốn từng loại ‣ Đường đứt nét xám = doanh thu hiện tại ‣ Đường đứt nét đỏ = trục hòa vốn (lãi = 0)
          </p>
        </div>
      </Card>

      {/* Notes */}
      <div className="mt-5 p-4 rounded-md bg-muted/20 border border-border/40 text-xs text-muted-foreground space-y-1.5">
        <div className="flex items-center gap-2 font-semibold text-foreground mb-2">
          <Info className="w-3.5 h-3.5" />
          <span>Ghi chú tính toán</span>
        </div>
        <p>
          • <strong>Cắt lại CĐT:</strong> Khoản tiền chuyển lại cho chủ đầu tư. Không được khấu
          trừ thuế TNDN và không xuất hiện trên hóa đơn/báo cáo tài chính.
        </p>
        <p>
          • <strong>Loại 1:</strong> Công ty chỉ nhận hợp đồng, không có kỹ sư công
          trường. Cắt lại cao ({(input.kickbackRateType1 * 100).toFixed(0)}%), chi phí lao động
          thấp.
        </p>
        <p>
          • <strong>Loại 2:</strong> Tự lo kỹ sư. Cắt lại thấp hơn (
          {(input.kickbackRateType2 * 100).toFixed(0)}%), chi phí lao động cao hơn — tạo tấm chắn
          thuế TNDN. Quỹ lương Kỹ sư bị giới hạn tối đa{" "}
          {((input.maxWageFundRate ?? 0.15) * 100).toFixed(0)}% doanh thu.
        </p>
        <p>
          • <strong>Thuế TNDN:</strong> Cắt lại CĐT <em>không</em> được khấu trừ khi tính thu
          nhập chịu thuế — đây là điểm quan trọng nhất cần ghi nhớ.
        </p>
        <p>
          • <strong>VAT đầu vào:</strong> Chỉ khấu trừ được trên phần chi phí có hóa đơn hợp lệ
          ({(deductibleRate * 100).toFixed(0)}% chi phí cố định).
        </p>
      </div>
    </div>
  );
}

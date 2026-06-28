import { useFinancial } from "@/context/FinancialContext";
import { Card } from "@/components/ui/card";
import { formatVND } from "@/lib/utils";
import { Link } from "wouter";

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

  // Derived values
  const directorAccountantWage = (input.directorSalaryMonthly + input.accountantSalaryMonthly) * 12;
  const technicianWage = input.numTechnicians * input.technicianSalaryMonthly * 12;
  const insuranceL1 = t1.laborCost - directorAccountantWage;
  const insuranceL2 = t2.laborCost - directorAccountantWage - technicianWage;
  const fixedCostDeductibleCIT = t1.fixedCost * 0.9;
  const fixedCostWithVatInvoice = t1.fixedCost * deductibleRate;
  const totalWithVat = result.totalRevenue + t1.vatOut;

  type RowKind = "value" | "section" | "spacer" | "both";

  interface SectionRow { kind: "section"; label: string }
  interface SpacerRow { kind: "spacer" }
  interface ValueRow {
    kind: "value";
    label: string;
    value: number;
    bold?: boolean;
    note?: string;
  }
  interface BothRow {
    kind: "both";
    label: string;
    v1: number;
    v2: number;
    bold?: boolean;
    note?: string;
  }

  type Row = SectionRow | SpacerRow | ValueRow | BothRow;

  const rows: Row[] = [
    // ── Doanh thu ──────────────────────────────────────────────────
    { kind: "section", label: "DOANH THU TƯ VẤN" },
    { kind: "value", label: "Doanh thu tư vấn giám sát", value: result.supervisionRevenue },
    { kind: "value", label: "Doanh thu tư vấn thiết kế", value: result.designRevenue },
    { kind: "value", label: "Tổng doanh thu tư vấn chưa VAT", value: result.totalRevenue, bold: true },

    // ── Chi phí cố định ──────────────────────────────────────────
    { kind: "spacer" },
    { kind: "section", label: "CHI PHÍ CỐ ĐỊNH CHUNG" },
    { kind: "value", label: "Thuê văn phòng / năm", value: input.officeRentMonthly * 12 },
    { kind: "value", label: "Đi lại + tiếp khách / năm", value: input.travelEntertainMonthly * 12 },
    { kind: "value", label: "Chi phí khác / năm", value: input.otherCostMonthly * 12 },
    { kind: "value", label: "Tổng chi phí cố định thực chi", value: t1.fixedCost, bold: true },
    {
      kind: "value",
      label: "Chi phí cố định được khấu trừ thuế TNDN",
      value: fixedCostDeductibleCIT,
      note: "90% chi phí có chứng từ hợp lệ",
    },

    // ── Chi phí lao động ──────────────────────────────────────────
    { kind: "spacer" },
    { kind: "section", label: "CHI PHÍ LAO ĐỘNG TRỰC TIẾP" },
    { kind: "value", label: "Lương GĐ + kế toán / năm", value: directorAccountantWage },
    { kind: "value", label: "Lương kỹ thuật trực tiếp Loại 2 / năm", value: technicianWage, note: `${input.numTechnicians} người × ${formatVND(input.technicianSalaryMonthly)}/tháng` },
    { kind: "both", label: "Bảo hiểm LĐ trực tiếp", v1: insuranceL1, v2: insuranceL2, note: `${(input.insuranceRate * 100).toFixed(1)}% lương` },
    { kind: "both", label: "Tổng chi phí lao động trực tiếp", v1: t1.laborCost, v2: t2.laborCost, bold: true },
    { kind: "both", label: "Chi phí lao động được khấu trừ thuế TNDN", v1: t1.laborCost, v2: t2.laborCost, note: "100% được khấu trừ" },

    // ── VAT và dòng tiền ──────────────────────────────────────────
    { kind: "spacer" },
    { kind: "section", label: "VAT VÀ DÒNG TIỀN" },
    { kind: "value", label: "VAT đầu ra", value: t1.vatOut, note: `${(input.vatRate * 100).toFixed(0)}% × doanh thu` },
    { kind: "value", label: "Chi phí có hóa đơn VAT hợp lệ", value: fixedCostWithVatInvoice, note: `${(deductibleRate * 100).toFixed(0)}% chi phí cố định` },
    { kind: "value", label: "VAT đầu vào được khấu trừ", value: t1.vatIn },
    { kind: "value", label: "VAT phải nộp", value: t1.vatDue, bold: true },
    { kind: "value", label: "Tổng tiền khách thanh toán gồm VAT", value: totalWithVat, bold: true },
    { kind: "value", label: "Doanh thu thuần sau bù trừ VAT", value: result.totalRevenue },

    // ── Chi phí ký hồ sơ ──────────────────────────────────────────
    { kind: "spacer" },
    { kind: "section", label: "CHI PHÍ KÝ HỒ SƠ" },
    { kind: "both", label: "Chi phí ký hồ sơ", v1: t1.signingCost, v2: t2.signingCost },
    {
      kind: "both",
      label: "Chi phí ký hồ sơ được khấu trừ thuế TNDN",
      v1: t1.signingCost * 0.9,
      v2: t2.signingCost * 0.9,
      note: "90% được khấu trừ (TT 78/2014)",
    },
  ];

  const SectionHeader = ({ label }: { label: string }) => (
    <div className="bg-muted/10 py-2 pl-4 text-xs font-semibold text-muted-foreground col-span-full border-b border-border/30">
      {label}
    </div>
  );

  const ValueCell = ({ v, bold }: { v: number; bold?: boolean }) => (
    <div className={`text-right pr-6 tabular-nums ${bold ? "font-bold text-foreground" : ""}`}>
      {formatVND(v)}
    </div>
  );

  return (
    <div className="p-6 max-w-[1000px] mx-auto min-h-full pb-20">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Tính Toán Trung Gian</h1>
        <p className="text-muted-foreground mt-1">BẢNG 2 — Chi tiết các khoản tính toán trung gian</p>
      </div>

      <Card className="overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_160px_160px] bg-muted py-3 border-b border-border font-semibold text-sm">
          <div className="pl-4">Chỉ tiêu</div>
          <div className="text-right pr-6">Loại 1</div>
          <div className="text-right pr-6 border-l border-border">Loại 2</div>
        </div>

        <div className="bg-card divide-y divide-border/30">
          {rows.map((row, idx) => {
            if (row.kind === "spacer") {
              return <div key={idx} className="h-2 bg-muted/5" />;
            }

            if (row.kind === "section") {
              return (
                <div key={idx} className="bg-muted/10 py-2 pl-4 text-xs font-semibold text-muted-foreground">
                  {row.label}
                </div>
              );
            }

            if (row.kind === "value") {
              return (
                <div key={idx} className={`grid grid-cols-[1fr_160px_160px] py-2.5 text-sm ${row.bold ? "bg-muted/20" : ""}`}>
                  <div className={`pl-4 pr-2 ${row.bold ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                    {row.label}
                    {row.note && <span className="block text-[10px] text-muted-foreground/60 font-normal">{row.note}</span>}
                  </div>
                  <ValueCell v={row.value} bold={row.bold} />
                  <div className="text-right pr-6 text-muted-foreground/40 text-xs flex items-center justify-end border-l border-border/30">—</div>
                </div>
              );
            }

            // kind === "both"
            return (
              <div key={idx} className={`grid grid-cols-[1fr_160px_160px] py-2.5 text-sm ${row.bold ? "bg-muted/20" : ""}`}>
                <div className={`pl-4 pr-2 ${row.bold ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  {row.label}
                  {row.note && <span className="block text-[10px] text-muted-foreground/60 font-normal">{row.note}</span>}
                </div>
                <ValueCell v={row.v1} bold={row.bold} />
                <div className={`text-right pr-6 tabular-nums border-l border-border/30 ${row.bold ? "font-bold text-foreground" : ""}`}>
                  {formatVND(row.v2)}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

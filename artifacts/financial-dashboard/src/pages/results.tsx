import { useFinancial } from "@/context/FinancialContext";
import { Card } from "@/components/ui/card";
import { formatVND, formatPercent } from "@/lib/utils";
import { Link } from "wouter";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { ContractResult } from "@workspace/api-client-react";

export default function ResultsPage() {
  const { result } = useFinancial();

  if (!result) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-12 text-center">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-6">
          <span className="text-2xl text-muted-foreground">?</span>
        </div>
        <h2 className="text-2xl font-bold mb-2">Chưa có kết quả</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Bạn cần nhập thông số và chạy tính toán trước khi xem kết quả chi tiết.
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

  function derived(c: ContractResult) {
    return {
      totalWithVat: c.revenue + c.vatOut,
      grossAfterDeductions: c.revenue - c.kickback - c.laborCost - c.signingCost,
      deductibleCost: c.revenue - c.taxableIncome,
      citRate: c.revenue > 0 ? c.corporateTax / c.revenue : 0,
      fixedCostRate: c.revenue > 0 ? c.fixedCost / c.revenue : 0,
      laborCostRate: c.revenue > 0 ? c.laborCost / c.revenue : 0,
    };
  }

  const d1 = derived(t1);
  const d2 = derived(t2);

  type Fmt = "currency" | "percent";

  const SectionHeader = ({ label, color = "muted" }: { label: string; color?: "muted" | "amber" | "blue" | "green" }) => {
    const colorMap: Record<string, string> = {
      muted: "bg-muted/10 text-muted-foreground",
      amber: "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-t border-amber-200 dark:border-amber-800",
      blue: "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400",
      green: "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400",
    };
    return (
      <div className={`py-2 pl-4 text-xs font-semibold ${colorMap[color]}`}>{label}</div>
    );
  };

  const Row = ({
    label,
    v1,
    v2,
    fmt = "currency",
    highlight = false,
    bold = false,
    note,
  }: {
    label: string;
    v1: number;
    v2: number;
    fmt?: Fmt;
    highlight?: boolean;
    bold?: boolean;
    note?: string;
  }) => {
    const f = (v: number) => fmt === "percent" ? formatPercent(v) : formatVND(v);
    const red = (v: number) => v < 0 ? "text-red-600 dark:text-red-500" : "";
    const hiGreen = (v: number) => highlight && v > 0 ? "text-green-600 dark:text-green-500" : "";
    const cls = (v: number) => [red(v), hiGreen(v), bold ? "font-bold" : ""].filter(Boolean).join(" ");

    return (
      <div className={`grid grid-cols-3 py-2.5 border-b border-border/40 text-sm ${highlight ? "bg-muted/20" : ""}`}>
        <div className={`pl-4 pr-2 ${bold ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
          {label}
          {note && <span className="block text-[10px] text-muted-foreground/70 font-normal">{note}</span>}
        </div>
        <div className={`text-right pr-6 ${cls(v1)}`}>{f(v1)}</div>
        <div className={`text-right pr-6 border-l border-border/40 ${cls(v2)}`}>{f(v2)}</div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-[1200px] mx-auto min-h-full pb-20">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Kết quả Tính toán</h1>
        <p className="text-muted-foreground mt-1">
          BẢNG SO SÁNH KẾT QUẢ 2 LOẠI HỢP ĐỒNG
        </p>
      </div>

      <div className="mb-6">
        <div className={`p-4 rounded-md border flex items-start gap-3 ${t2.netProfit > t1.netProfit ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900" : "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900"}`}>
          <CheckCircle2 className={`w-5 h-5 mt-0.5 ${t2.netProfit > t1.netProfit ? "text-green-600" : "text-blue-600"}`} />
          <div>
            <h3 className="font-semibold text-foreground">Khuyến nghị chiến lược</h3>
            <p className="text-sm mt-1 text-muted-foreground">{result.recommendation}</p>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-3 bg-muted py-3 border-b border-border font-semibold text-sm">
          <div className="pl-4">Chỉ tiêu</div>
          <div className="text-right pr-6">HĐ loại 1 (Chỉ ký và đóng dấu)</div>
          <div className="text-right pr-6 border-l border-border">HĐ loại 2 (Làm hết nhiệm vụ)</div>
        </div>

        <div className="bg-card">

          {/* ── DOANH THU ── */}
          <SectionHeader label="DOANH THU" />
          <Row label="Doanh thu trước VAT" v1={t1.revenue} v2={t2.revenue} bold />
          <Row label="VAT đầu ra" v1={t1.vatOut} v2={t2.vatOut} />
          <Row
            label="Tổng tiền khách thanh toán (gồm VAT)"
            v1={d1.totalWithVat}
            v2={d2.totalWithVat}
            highlight
            bold
          />

          {/* ── CHI PHÍ ── */}
          <SectionHeader label="CÁC KHOẢN CHI PHÍ" />
          <Row
            label="Cắt lại CĐT không được khấu trừ"
            v1={t1.kickback}
            v2={t2.kickback}
            note="Không được khấu trừ CIT"
          />
          <Row label="Chi phí lao động trực tiếp" v1={t1.laborCost} v2={t2.laborCost} />
          <Row label="Chi phí ký hồ sơ" v1={t1.signingCost} v2={t2.signingCost} />
          <Row label="Chi phí cố định thực chi" v1={t1.fixedCost} v2={t2.fixedCost} />

          {/* ── LÃI GỘP ── */}
          <SectionHeader label="LÃI GỘP & DÒNG TIỀN" />
          <Row
            label="Lãi gộp sau cắt lại, lao động và ký hồ sơ"
            v1={d1.grossAfterDeductions}
            v2={d2.grossAfterDeductions}
            note="Doanh thu − Cắt lại − Lao động − Ký hồ sơ"
            highlight
          />
          <Row
            label="Lãi trước thuế theo dòng tiền"
            v1={t1.cashFlowBeforeTax}
            v2={t2.cashFlowBeforeTax}
            note="Sau trừ thêm chi phí cố định"
            bold
          />

          {/* ── THUẾ ── */}
          <SectionHeader label="NGHĨA VỤ THUẾ TNDN & VAT" color="blue" />
          <Row
            label="Chi phí được khấu trừ thuế TNDN"
            v1={d1.deductibleCost}
            v2={d2.deductibleCost}
            note="Doanh thu − Thu nhập chịu thuế"
          />
          <Row label="Thu nhập chịu thuế TNDN" v1={t1.taxableIncome} v2={t2.taxableIncome} highlight />
          <Row label="Thuế TNDN phải nộp" v1={t1.corporateTax} v2={t2.corporateTax} bold />
          <Row label="Thuế TNDN / Doanh thu" v1={d1.citRate} v2={d2.citRate} fmt="percent" />
          <Row label="VAT đầu vào đã trả nhà cung cấp" v1={t1.vatIn} v2={t2.vatIn} />
          <Row label="VAT phải nộp" v1={t1.vatDue} v2={t2.vatDue} bold />

          {/* ── KẾT QUẢ CUỐI CÙNG ── */}
          <SectionHeader label="KẾT QUẢ CUỐI CÙNG" color="green" />
          <Row label="Lãi ròng sau thuế TNDN" v1={t1.netProfit} v2={t2.netProfit} highlight bold />
          <Row label="Lãi ròng / tháng" v1={t1.netProfitMonthly} v2={t2.netProfitMonthly} />
          <Row label="Biên lãi ròng (%)" v1={t1.netMargin} v2={t2.netMargin} fmt="percent" highlight />
          <Row label="Chi phí cố định / Doanh thu" v1={d1.fixedCostRate} v2={d2.fixedCostRate} fmt="percent" />
          <Row label="Chi phí lao động trực tiếp / Doanh thu" v1={d1.laborCostRate} v2={d2.laborCostRate} fmt="percent" />
          <Row
            label="Dòng tiền sau nộp VAT và thuế TNDN"
            v1={t1.netProfit}
            v2={t2.netProfit}
            bold
            highlight
          />
        </div>
      </Card>

      {(!t1.isViable || !t2.isViable || t1.technicianWageRatio > 0.2 || t2.technicianWageRatio > 0.2) && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {!t1.isViable && (
            <div className="p-4 rounded-md bg-red-50 border border-red-200 flex gap-3 text-red-800 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div className="text-sm">
                <span className="font-bold">Cảnh báo Loại 1:</span> Lãi ròng âm. Phương án này đang gây lỗ, cần điều chỉnh tỷ lệ cắt lại CĐT.
              </div>
            </div>
          )}
          {!t2.isViable && (
            <div className="p-4 rounded-md bg-red-50 border border-red-200 flex gap-3 text-red-800 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div className="text-sm">
                <span className="font-bold">Cảnh báo Loại 2:</span> Lãi ròng âm. Phương án này đang gây lỗ, cần xem xét lại chi phí kỹ sư.
              </div>
            </div>
          )}
          {(t1.technicianWageRatio > 0.2 || t2.technicianWageRatio > 0.2) && (
            <div className="p-4 rounded-md bg-amber-50 border border-amber-200 flex gap-3 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-500">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div className="text-sm">
                <span className="font-bold">Rủi ro thuế:</span> Quỹ lương kỹ sư vượt 20% doanh thu. Thuế có thể bóc tách chi phí này nếu không chứng minh được tính hợp lý.
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 text-xs text-muted-foreground space-y-1 border-t border-border/40 pt-4">
        <p>* Lương giám đốc và kế toán được tính vào chi phí lao động trực tiếp của cả hai loại hợp đồng.</p>
        <p>* Loại 1 không có lương 2 kỹ sư; Loại 2 có thêm lương 2 kỹ sư và bảo hiểm liên quan.</p>
        <p>* Chi phí ký hồ sơ: Loại 1 mặc định 5% doanh thu chưa VAT; Loại 2 = 0% (không áp dụng).</p>
        <p>* Phần cắt lại CĐT là dòng tiền ra nhưng không được khấu trừ TNDN và không có VAT đầu vào.</p>
      </div>
    </div>
  );
}

import { useFinancial } from "@/context/FinancialContext";
import { Card } from "@/components/ui/card";
import { formatVND, formatPercent } from "@/lib/utils";
import { Link } from "wouter";
import { TrendingUp, ArrowRight, Settings2 } from "lucide-react";
import type { ContractResult } from "@workspace/api-client-react";
import { loadCt7Config, applyCt7, computeCt7Cost, type Ct7Result, type Ct7Config } from "@/lib/ct7-optimize";

export default function OptimizedResultsPage() {
  const { result, input } = useFinancial();
  // Cấu hình CT7 RIÊNG cho từng loại HĐ
  const config1 = loadCt7Config("type1");
  const config2 = loadCt7Config("type2");

  // ── Trạng thái rỗng ──────────────────────────────────────────────────────
  if (!result) {
    return (
      <EmptyState
        title="Chưa có kết quả để tối ưu"
        desc="Bạn cần nhập thông số và chạy tính toán ở mục Nhập thông số trước."
        href="/input"
        cta="Nhập thông số ngay"
      />
    );
  }
  if (!config1 || !config2) {
    return (
      <EmptyState
        title="Chưa cấu hình tối ưu thuế"
        desc="Hãy sang mục Tối ưu thuế, cấu hình phương án thuê nhân sự (CTV/HĐLĐ) cho cả Loại 1 và Loại 2 rồi quay lại đây để xem kết quả sau tối ưu."
        href="/optimize"
        cta="Sang mục Tối ưu thuế"
        icon={<Settings2 className="w-7 h-7 text-muted-foreground" />}
      />
    );
  }

  const taxRate = input.corporateTaxRate;
  const cost1 = computeCt7Cost(config1);
  const cost2 = computeCt7Cost(config2);
  const opt1 = applyCt7(
    { taxableIncome: result.type1.taxableIncome, corporateTax: result.type1.corporateTax, netProfit: result.type1.netProfit },
    config1, taxRate,
  );
  const opt2 = applyCt7(
    { taxableIncome: result.type2.taxableIncome, corporateTax: result.type2.corporateTax, netProfit: result.type2.netProfit },
    config2, taxRate,
  );

  const t1 = result.type1, t2 = result.type2;

  // Giá trị "sau tối ưu" cho từng chỉ tiêu (chỉ phần thuế & lãi ròng thay đổi)
  const after = (c: ContractResult, o: Ct7Result) => ({
    deductibleCost: (c.revenue - c.taxableIncome) + o.totalDeductibleAnnual,
    taxableIncome: o.newTaxableIncome,
    corporateTax: o.newCIT,
    netProfit: o.finalNetProfit,
    netProfitMonthly: o.finalNetProfitMonthly,
    netMargin: c.revenue > 0 ? o.finalNetProfit / c.revenue : 0,
  });
  const a1 = after(t1, opt1), a2 = after(t2, opt2);

  return (
    <div className="p-6 max-w-[1280px] mx-auto min-h-full pb-20">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Kết quả kinh doanh sau khi tối ưu thuế</h1>
        <p className="text-muted-foreground mt-1">
          Áp phương án thuê nhân sự (Chiến thuật 7) từ mục Tối ưu thuế vào kết quả — so sánh Trước → Sau.
        </p>
      </div>

      {/* Cấu hình tối ưu đang áp dụng — RIÊNG từng loại HĐ */}
      <div className="mb-6 rounded-md border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 text-sm divide-y divide-purple-200/60 dark:divide-purple-800/60">
        <ConfigLine type="Loại 1" cfg={config1} deduct={cost1.totalDeductibleAnnual} />
        <ConfigLine type="Loại 2" cfg={config2} deduct={cost2.totalDeductibleAnnual} />
      </div>

      {/* KPI lãi ròng trước → sau */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <DeltaKpi label="Lãi ròng Loại 1 (Chỉ ký & đóng dấu)" before={t1.netProfit} after={opt1.finalNetProfit} saved={opt1.ct7CITSaved} />
        <DeltaKpi label="Lãi ròng Loại 2 (Lo trọn gói)" before={t2.netProfit} after={opt2.finalNetProfit} saved={opt2.ct7CITSaved} />
      </div>

      <Card className="overflow-hidden">
        {/* Header: mỗi loại có cột Trước & Sau */}
        <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr_1fr] bg-muted text-xs font-semibold border-b border-border">
          <div className="py-3 pl-4 flex items-end">Chỉ tiêu</div>
          <div className="py-3 text-right pr-4 border-l border-border col-span-2">
            <div className="pb-1">HĐ Loại 1</div>
            <div className="grid grid-cols-2 text-[10px] text-muted-foreground font-normal">
              <span className="text-right pr-1">Trước</span><span className="text-right">Sau</span>
            </div>
          </div>
          <div className="py-3 text-right pr-4 border-l border-border col-span-2">
            <div className="pb-1">HĐ Loại 2</div>
            <div className="grid grid-cols-2 text-[10px] text-muted-foreground font-normal">
              <span className="text-right pr-1">Trước</span><span className="text-right">Sau</span>
            </div>
          </div>
        </div>

        <div className="bg-card">
          <Section label="DOANH THU (không đổi)" />
          <BARow label="Doanh thu trước VAT" b1={t1.revenue} a1={t1.revenue} b2={t2.revenue} a2={t2.revenue} />
          <BARow label="VAT đầu ra" b1={t1.vatOut} a1={t1.vatOut} b2={t2.vatOut} a2={t2.vatOut} />

          <Section label="CHI PHÍ HOẠT ĐỘNG (không đổi)" />
          <BARow label="Cắt lại CĐT (không khấu trừ)" b1={t1.kickback} a1={t1.kickback} b2={t2.kickback} a2={t2.kickback} />
          <BARow label="Chi phí lao động trực tiếp" b1={t1.laborCost} a1={t1.laborCost} b2={t2.laborCost} a2={t2.laborCost} />
          <BARow label="Chi phí ký hồ sơ" b1={t1.signingCost} a1={t1.signingCost} b2={t2.signingCost} a2={t2.signingCost} />
          <BARow label="Chi phí cố định thực chi" b1={t1.fixedCost} a1={t1.fixedCost} b2={t2.fixedCost} a2={t2.fixedCost} />

          <Section label="TỐI ƯU THUẾ TNDN (Chiến thuật 7)" color="purple" />
          <BARow label="Chi phí lao động thuê ngoài (khấu trừ thêm)"
            b1={0} a1={cost1.totalDeductibleAnnual} b2={0} a2={cost2.totalDeductibleAnnual} goodUp note="Tăng chi phí được khấu trừ" />
          <BARow label="Tổng chi phí được khấu trừ TNDN"
            b1={t1.revenue - t1.taxableIncome} a1={a1.deductibleCost} b2={t2.revenue - t2.taxableIncome} a2={a2.deductibleCost} goodUp />
          <BARow label="Thu nhập chịu thuế TNDN"
            b1={t1.taxableIncome} a1={a1.taxableIncome} b2={t2.taxableIncome} a2={a2.taxableIncome} goodDown />
          <BARow label="Thuế TNDN phải nộp"
            b1={t1.corporateTax} a1={a1.corporateTax} b2={t2.corporateTax} a2={a2.corporateTax} goodDown bold />
          <BARow label="Chi phí thực CT7 (TNCN + bảo hiểm)"
            b1={0} a1={cost1.section7RealCost} b2={0} a2={cost2.section7RealCost} goodDown note="Tiền công ty thực bỏ ra" />

          <Section label="KẾT QUẢ CUỐI CÙNG" color="green" />
          <BARow label="Lãi ròng sau thuế" b1={t1.netProfit} a1={a1.netProfit} b2={t2.netProfit} a2={a2.netProfit} goodUp bold highlight />
          <BARow label="Lãi ròng / tháng" b1={t1.netProfitMonthly} a1={a1.netProfitMonthly} b2={t2.netProfitMonthly} a2={a2.netProfitMonthly} goodUp />
          <BARow label="Biên lãi ròng (%)" b1={t1.netMargin} a1={a1.netMargin} b2={t2.netMargin} a2={a2.netMargin} fmt="percent" goodUp />
        </div>
      </Card>

      <div className="mt-4 text-xs text-muted-foreground space-y-1 border-t border-border/40 pt-4">
        <p>* Chiến thuật 7: thuê CTV/nhân viên ngắn hạn, kê khai lương + TNCN (+ BHXH nếu HĐLĐ) đầy đủ để được khấu trừ thuế TNDN.</p>
        <p>* Chi phí được khấu trừ thêm làm giảm thu nhập chịu thuế → giảm thuế TNDN. Chi phí thực công ty bỏ ra chỉ gồm TNCN và bảo hiểm.</p>
        <p>* Các khoản doanh thu, cắt lại CĐT, lao động, ký hồ sơ, chi phí cố định giữ nguyên như mục Kết quả.</p>
        <p>* Cấu hình phương án (số nhân sự, lương, loại HĐ thuê) lấy từ mục <Link href="/optimize"><span className="text-primary underline cursor-pointer">Tối ưu thuế</span></Link>.</p>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function EmptyState({ title, desc, href, cta, icon }: { title: string; desc: string; href: string; cta: string; icon?: React.ReactNode }) {
  return (
    <div className="min-h-full flex flex-col items-center justify-center p-12 text-center">
      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-6">
        {icon ?? <span className="text-2xl text-muted-foreground">?</span>}
      </div>
      <h2 className="text-2xl font-bold mb-2">{title}</h2>
      <p className="text-muted-foreground mb-6 max-w-md">{desc}</p>
      <Link href={href}>
        <div className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2.5 rounded-md font-medium cursor-pointer transition-colors">
          {cta}
        </div>
      </Link>
    </div>
  );
}

function ConfigLine({ type, cfg, deduct }: { type: string; cfg: Ct7Config; deduct: number }) {
  return (
    <div className="p-3 flex flex-wrap gap-x-6 gap-y-1 items-center">
      <span className="font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1.5 w-20">
        <Settings2 className="w-4 h-4" /> {type}
      </span>
      <span>HĐ thuê: <strong>{cfg.contractType === "ctv" ? "Dịch vụ/CTV (không BHXH)" : "HĐ lao động (có BHXH)"}</strong></span>
      <span>Số nhân sự: <strong>{cfg.numStaff}</strong></span>
      <span>Lương gross/người: <strong>{formatVND(cfg.monthlyGross)}/tháng</strong></span>
      <span>Khấu trừ thêm: <strong className="text-purple-700 dark:text-purple-300">{formatVND(deduct)}/năm</strong></span>
    </div>
  );
}

function DeltaKpi({ label, before, after, saved }: { label: string; before: number; after: number; saved: number }) {
  const delta = after - before;
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground mb-2">{label}</div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-base text-muted-foreground line-through">{formatVND(before)}</span>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
        <span className={`text-2xl font-bold ${after >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{formatVND(after)}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-xs">
        <TrendingUp className="w-3.5 h-3.5 text-green-600" />
        <span className={delta >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
          {delta >= 0 ? "+" : ""}{formatVND(delta)}
        </span>
        <span className="text-muted-foreground">(tiết kiệm thuế {formatVND(saved)})</span>
      </div>
    </Card>
  );
}

function Section({ label, color = "muted" }: { label: string; color?: "muted" | "purple" | "green" }) {
  const map: Record<string, string> = {
    muted: "bg-muted/10 text-muted-foreground",
    purple: "bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400",
    green: "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400",
  };
  return <div className={`py-2 pl-4 text-xs font-semibold ${map[color]}`}>{label}</div>;
}

function BARow({
  label, b1, a1, b2, a2, fmt = "currency", goodUp, goodDown, bold, highlight, note,
}: {
  label: string; b1: number; a1: number; b2: number; a2: number;
  fmt?: "currency" | "percent"; goodUp?: boolean; goodDown?: boolean; bold?: boolean; highlight?: boolean; note?: string;
}) {
  const f = (v: number) => (fmt === "percent" ? formatPercent(v) : formatVND(v));
  // Màu cho cột "Sau": tăng tốt (goodUp) hoặc giảm tốt (goodDown)
  const afterCls = (before: number, afterV: number) => {
    const changed = Math.abs(afterV - before) > 0.0001;
    if (!changed) return "";
    const improved = goodUp ? afterV > before : goodDown ? afterV < before : false;
    return improved ? "text-green-600 dark:text-green-400" : afterV < 0 ? "text-red-600 dark:text-red-500" : "";
  };
  const beforeCls = (v: number) => (v < 0 ? "text-red-600 dark:text-red-500" : "text-muted-foreground");

  return (
    <div className={`grid grid-cols-[1.6fr_1fr_1fr_1fr_1fr] py-2.5 border-b border-border/40 text-sm ${highlight ? "bg-muted/20" : ""}`}>
      <div className={`pl-4 pr-2 ${bold ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
        {label}
        {note && <span className="block text-[10px] text-muted-foreground/70 font-normal">{note}</span>}
      </div>
      <div className={`text-right pr-1 text-xs ${beforeCls(b1)}`}>{f(b1)}</div>
      <div className={`text-right pr-4 ${bold ? "font-bold" : ""} ${afterCls(b1, a1)}`}>{f(a1)}</div>
      <div className={`text-right pr-1 text-xs border-l border-border/40 ${beforeCls(b2)}`}>{f(b2)}</div>
      <div className={`text-right pr-4 ${bold ? "font-bold" : ""} ${afterCls(b2, a2)}`}>{f(a2)}</div>
    </div>
  );
}

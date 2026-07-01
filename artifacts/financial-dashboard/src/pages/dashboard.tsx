import { useFinancial } from "@/context/FinancialContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatVND, formatPercent } from "@/lib/utils";
import { Link } from "wouter";
import { Printer, RefreshCw, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import { CSVLink } from "react-csv";
import { Download } from "lucide-react";
import type { ContractResult } from "@workspace/api-client-react";

const CHART_COLORS = {
  blue: "#0079F2",
  purple: "#795EFF",
  green: "#009118",
  red: "#A60808",
  pink: "#ec4899",
};

const CHART_COLOR_LIST = [CHART_COLORS.blue, CHART_COLORS.purple, CHART_COLORS.green, CHART_COLORS.red, CHART_COLORS.pink];

/** KPI block for one contract type — keeps Loại 1 và Loại 2 trình bày đối xứng. */
function ContractKpiGroup({
  label,
  accent,
  data,
  highlight,
}: {
  label: string;
  accent: string;
  data: ContractResult;
  highlight: boolean;
}) {
  return (
    <Card className={highlight ? "border-2" : ""} style={highlight ? { borderColor: accent } : undefined}>
      <CardHeader className="flex-row items-center justify-between pb-3 border-b border-border/50">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accent }} />
          {label}
        </CardTitle>
        {highlight && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
            style={{ backgroundColor: accent }}
          >
            Tối ưu hơn
          </span>
        )}
      </CardHeader>
      <CardContent className="p-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">Lãi ròng</p>
            <p className={`text-xl font-bold ${data.netProfit >= 0 ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"}`}>
              {formatVND(data.netProfit)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">Biên lãi ròng</p>
            <p className={`text-xl font-bold ${data.netMargin >= 0 ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"}`}>
              {formatPercent(data.netMargin)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">Thuế TNDN</p>
            <p className="text-xl font-bold" style={{ color: accent }}>{formatVND(data.corporateTax)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">VAT phải nộp</p>
            <p className="text-xl font-bold text-foreground">{formatVND(data.vatDue)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { result } = useFinancial();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isDark = document.documentElement.classList.contains("dark");

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!result) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-12 text-center">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-6">
          <span className="text-2xl text-muted-foreground">?</span>
        </div>
        <h2 className="text-2xl font-bold mb-2">Chưa có dữ liệu</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Bạn cần nhập thông số và chạy tính toán trước khi xem Dashboard tổng quan.
        </p>
        <Link href="/input">
          <div className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2.5 rounded-md font-medium cursor-pointer transition-colors">
            Nhập thông số ngay
          </div>
        </Link>
      </div>
    );
  }

  const revenueData = [
    { name: "Thiết kế", value: result.designRevenue },
    { name: "Giám sát", value: result.supervisionRevenue }
  ];

  const marginData = [
    { name: "Loại 1", value: result.type1.netMargin * 100 },
    { name: "Loại 2", value: result.type2.netMargin * 100 }
  ];

  const costData = [
    { name: "Cắt lại", Type1: result.type1.kickback, Type2: result.type2.kickback },
    { name: "Nhân sự", Type1: result.type1.laborCost, Type2: result.type2.laborCost },
    { name: "Cố định", Type1: result.type1.fixedCost, Type2: result.type2.fixedCost },
    { name: "Ký hồ sơ", Type1: result.type1.signingCost, Type2: result.type2.signingCost },
    { name: "Thuế TNDN", Type1: result.type1.corporateTax, Type2: result.type2.corporateTax },
  ];

  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "#e5e5e5";
  const tickColor = isDark ? "#98999C" : "#71717a";

  const renderTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    return (
      <div className="bg-card text-card-foreground border border-border p-3 rounded-md shadow-md text-sm">
        <div className="font-medium mb-2">{label}</div>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex justify-between gap-4 mb-1">
            <span style={{ color: entry.color }}>{entry.name}</span>
            <span className="font-medium">
              {entry.name === 'value' ? formatPercent(entry.value / 100) : formatVND(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto min-h-full">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Tổng Quan</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Theo dõi sức khoẻ tài chính, doanh thu và tối ưu chi phí
          </p>
        </div>
        <div className="flex items-center gap-3 print:hidden">
          <div className="relative" ref={dropdownRef}>
            <div
              className="flex items-center rounded-md overflow-hidden h-[32px] text-sm border border-border shadow-sm"
            >
              <button className="flex items-center gap-2 px-3 h-full hover:bg-muted transition-colors bg-card">
                <RefreshCw className="w-3.5 h-3.5" />
                Làm mới
              </button>
              <div className="w-px h-full bg-border shrink-0" />
              <button 
                onClick={() => setDropdownOpen((o) => !o)} 
                className="flex items-center justify-center px-2 h-full hover:bg-muted transition-colors bg-card"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-md shadow-md py-1 z-50">
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">Tự động làm mới</div>
                <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors">Tắt</button>
                <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors">Mỗi 5 phút</button>
              </div>
            )}
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center justify-center w-[32px] h-[32px] rounded-md border border-border bg-card hover:bg-muted transition-colors shadow-sm"
            aria-label="Export as PDF"
          >
            <Printer className="w-4 h-4 text-foreground" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground font-medium mb-1">Tổng doanh thu</p>
            <p className="text-2xl font-bold" style={{ color: CHART_COLORS.blue }}>{formatVND(result.totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground font-medium mb-1">Lãi ròng (Loại 1)</p>
            <p className={`text-2xl font-bold ${result.type1.netProfit >= 0 ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"}`}>
              {formatVND(result.type1.netProfit)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground font-medium mb-1">Lãi ròng (Loại 2)</p>
            <p className={`text-2xl font-bold ${result.type2.netProfit >= 0 ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"}`}>
              {formatVND(result.type2.netProfit)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground font-medium mb-1">Chênh lệch lãi ròng</p>
            <p className="text-2xl font-bold text-foreground">{formatVND(Math.abs(result.type1.netProfit - result.type2.netProfit))}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {result.type1.netProfit >= result.type2.netProfit ? "Loại 1 cao hơn" : "Loại 2 cao hơn"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ContractKpiGroup
          label="Hợp đồng Loại 1"
          accent={CHART_COLORS.blue}
          data={result.type1}
          highlight={result.type1.netProfit >= result.type2.netProfit}
        />
        <ContractKpiGroup
          label="Hợp đồng Loại 2"
          accent={CHART_COLORS.purple}
          data={result.type2}
          highlight={result.type2.netProfit > result.type1.netProfit}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2 border-b border-border/50 mb-4">
            <CardTitle className="text-base font-semibold">Cơ cấu doanh thu</CardTitle>
            <CSVLink data={revenueData} filename="doanh-thu.csv" className="print:hidden p-1.5 rounded-md hover:bg-muted transition-colors" title="Tải CSV">
              <Download className="w-4 h-4 text-muted-foreground" />
            </CSVLink>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie 
                  data={revenueData} 
                  dataKey="value" 
                  nameKey="name" 
                  cx="50%" 
                  cy="50%" 
                  innerRadius={60}
                  outerRadius={100} 
                  cornerRadius={4} 
                  paddingAngle={2} 
                  stroke="none"
                  isAnimationActive={false}
                >
                  {revenueData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLOR_LIST[index % CHART_COLOR_LIST.length]} />
                  ))}
                </Pie>
                <RechartsTooltip content={renderTooltip} />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2 border-b border-border/50 mb-4">
            <CardTitle className="text-base font-semibold">So sánh chi phí (Loại 1 vs Loại 2)</CardTitle>
            <CSVLink data={costData} filename="chi-phi.csv" className="print:hidden p-1.5 rounded-md hover:bg-muted transition-colors" title="Tải CSV">
              <Download className="w-4 h-4 text-muted-foreground" />
            </CSVLink>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={costData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="name" stroke={tickColor} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke={tickColor} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`} />
                <RechartsTooltip content={renderTooltip} cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }} />
                <Legend iconType="circle" />
                <Bar dataKey="Type1" name="HĐ Loại 1" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} />
                <Bar dataKey="Type2" name="HĐ Loại 2" fill={CHART_COLORS.purple} radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2 border-b border-border/50 mb-4">
            <CardTitle className="text-base font-semibold">Biên lãi ròng (%)</CardTitle>
            <CSVLink data={marginData} filename="bien-lai.csv" className="print:hidden p-1.5 rounded-md hover:bg-muted transition-colors" title="Tải CSV">
              <Download className="w-4 h-4 text-muted-foreground" />
            </CSVLink>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={marginData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                <XAxis type="number" stroke={tickColor} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} />
                <YAxis dataKey="name" type="category" stroke={tickColor} fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip content={renderTooltip} cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }} />
                <Bar dataKey="value" name="Biên lãi (%)" fill={CHART_COLORS.green} radius={[0, 4, 4, 0]} maxBarSize={40} isAnimationActive={false}>
                  {marginData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.value > 0 ? CHART_COLORS.green : CHART_COLORS.red} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 border-b border-border/50 mb-4">
            <CardTitle className="text-base font-semibold">Phân tích điểm hoà vốn</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6 pt-2">
              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="font-medium text-sm">Hợp đồng Loại 1</span>
                  <div className="text-right">
                    <div className="text-sm font-bold">{formatVND(result.type1.breakEvenRevenue)}</div>
                    <div className="text-xs text-muted-foreground">Điểm hoà vốn</div>
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-3 mb-1 overflow-hidden">
                  <div 
                    className="bg-blue-500 h-3 rounded-full transition-all" 
                    style={{ width: `${Math.min(100, (result.totalRevenue / result.type1.breakEvenRevenue) * 100)}%` }}
                  ></div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Hiện tại: {formatVND(result.totalRevenue)} 
                  <span className={result.totalRevenue >= result.type1.breakEvenRevenue ? "text-green-600 ml-1" : "text-red-600 ml-1"}>
                    ({result.totalRevenue >= result.type1.breakEvenRevenue ? 'Vượt hoà vốn' : 'Chưa hoà vốn'})
                  </span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="font-medium text-sm">Hợp đồng Loại 2</span>
                  <div className="text-right">
                    <div className="text-sm font-bold">{formatVND(result.type2.breakEvenRevenue)}</div>
                    <div className="text-xs text-muted-foreground">Điểm hoà vốn</div>
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-3 mb-1 overflow-hidden">
                  <div 
                    className="bg-purple-500 h-3 rounded-full transition-all" 
                    style={{ width: `${Math.min(100, (result.totalRevenue / result.type2.breakEvenRevenue) * 100)}%` }}
                  ></div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Hiện tại: {formatVND(result.totalRevenue)}
                  <span className={result.totalRevenue >= result.type2.breakEvenRevenue ? "text-green-600 ml-1" : "text-red-600 ml-1"}>
                    ({result.totalRevenue >= result.type2.breakEvenRevenue ? 'Vượt hoà vốn' : 'Chưa hoà vốn'})
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

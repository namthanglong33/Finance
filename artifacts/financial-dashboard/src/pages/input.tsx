import { useFinancial } from "@/context/FinancialContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useCalculate, useGetFeeRates } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calculator } from "lucide-react";
import { usePersistentState } from "@/hooks/use-persistent-state";
import type { FinancialInput } from "@workspace/api-client-react";
import { formatVND } from "@/lib/utils";

export default function InputPage() {
  const { input, setInput, setResult, setLastUpdated } = useFinancial();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Giữ lại khi chuyển mục / tải lại trang
  const [grade, setGrade] = usePersistentState("ntl.input.grade", "Cấp III");
  const [constructionType, setConstructionType] = usePersistentState("ntl.input.constructionType", "Dân dụng");
  const [bidValue, setBidValue] = usePersistentState<number>("ntl.input.bidValue", input.constructionValue);

  const calculateMutation = useCalculate();
  const feeRateMutation = useGetFeeRates();

  const handleFieldChange = (field: keyof FinancialInput, value: number) => {
    setInput(prev => ({ ...prev, [field]: value }));
  };

  const handleRateChange = (field: keyof FinancialInput, value: string) => {
    const numValue = value === "" ? 0 : parseFloat(value);
    setInput(prev => ({ ...prev, [field]: numValue }));
  };

  const handleCalculateFeeRates = () => {
    feeRateMutation.mutate(
      // Kế hoạch kinh doanh giả định toàn bộ gói thiết kế là THIẾT KẾ 2 BƯỚC (chỉ BVTC, Bảng chẵn)
      { data: { constructionValue: bidValue, constructionGrade: grade, constructionType, designStep: 2 } },
      {
        onSuccess: (res) => {
          setInput(prev => ({
            ...prev,
            supervisionRate: res.supervisionRate,
            designRate: res.designRate
          }));
          toast({
            title: "Tính tỷ lệ phí thành công",
            description: `Giám sát: ${(res.supervisionRate * 100).toFixed(3)}%, Thiết kế: ${(res.designRate * 100).toFixed(3)}%`,
          });
        },
        onError: () => {
          toast({
            title: "Lỗi",
            description: "Không thể lấy tỷ lệ phí tự động.",
            variant: "destructive"
          });
        }
      }
    );
  };

  const handleSubmit = () => {
    calculateMutation.mutate(
      { data: input },
      {
        onSuccess: (res) => {
          setResult(res);
          setLastUpdated(new Date());
          toast({
            title: "Tính toán thành công",
            description: "Đã cập nhật kết quả tài chính.",
          });
          setLocation("/results");
        },
        onError: () => {
          toast({
            title: "Lỗi",
            description: "Không thể tính toán. Vui lòng kiểm tra lại thông số.",
            variant: "destructive"
          });
        }
      }
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto pb-24">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Nhập thông số đầu vào</h1>
        <p className="text-muted-foreground mt-1">
          Thiết lập các thông số tài chính, chi phí và thuế để mô phỏng hiệu quả hợp đồng.
        </p>
      </div>

      <div className="space-y-6">
        {/* Section 1: Thông tin gói thầu — chỉ nội suy tỷ lệ phí */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Thông tin gói thầu & Tỷ lệ phí</CardTitle>
            <CardDescription>
              Nội suy tỷ lệ phí % Giám sát (Bảng 2.24) &amp; Thiết kế (giả định <strong>thiết kế 2 bước</strong> — chỉ BVTC,
              Bảng 2.8/2.10/2.12/2.14/2.16) theo TT 38/2026/TT-BXD.
              Giá trị ở đây chỉ dùng để tra bậc tỷ lệ, không trực tiếp tính doanh thu.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <Label htmlFor="bidValue">Giá trị gói thầu (VNĐ, để nội suy tỷ lệ)</Label>
                <CurrencyInput
                  id="bidValue"
                  value={bidValue}
                  onChange={setBidValue}
                />
              </div>
              <div className="space-y-2">
                <Label>Loại công trình (Giám sát &amp; Thiết kế)</Label>
                <Select value={constructionType} onValueChange={setConstructionType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn loại" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dân dụng">Dân dụng</SelectItem>
                    <SelectItem value="Công nghiệp">Công nghiệp</SelectItem>
                    <SelectItem value="Giao thông">Giao thông</SelectItem>
                    <SelectItem value="Nông nghiệp & môi trường">Nông nghiệp &amp; môi trường</SelectItem>
                    <SelectItem value="Hạ tầng kỹ thuật">Hạ tầng kỹ thuật</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cấp công trình (thiết kế)</Label>
                <Select value={grade} onValueChange={setGrade}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn cấp" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cấp đặc biệt">Cấp đặc biệt</SelectItem>
                    <SelectItem value="Cấp I">Cấp I</SelectItem>
                    <SelectItem value="Cấp II">Cấp II</SelectItem>
                    <SelectItem value="Cấp III">Cấp III</SelectItem>
                    <SelectItem value="Cấp IV">Cấp IV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={handleCalculateFeeRates}
                  disabled={feeRateMutation.isPending}
                >
                  {feeRateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calculator className="w-4 h-4 mr-2" />}
                  Tính tỷ lệ phí tự động
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-2">
                <Label htmlFor="supervisionRate">Tỷ lệ phí Giám sát (Hệ số - VD: 0.03285)</Label>
                <Input
                  id="supervisionRate"
                  type="number"
                  step="0.00001"
                  value={input.supervisionRate}
                  onChange={(e) => handleRateChange("supervisionRate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="designRate">Tỷ lệ phí Thiết kế (Hệ số - VD: 0.0341)</Label>
                <Input
                  id="designRate"
                  type="number"
                  step="0.00001"
                  value={input.designRate}
                  onChange={(e) => handleRateChange("designRate", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 1a: Tổng giá trị xây lắp — cơ sở tính doanh thu */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Tổng giá trị xây lắp</CardTitle>
            <CardDescription>
              Giá trị xây lắp thực tế của hợp đồng. Doanh thu = Tổng giá trị xây lắp × Tỷ lệ phí đã nội suy ở trên
              (Giám sát + Thiết kế). Đây là con số được đưa vào toàn bộ tính toán.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="constructionValue">Tổng giá trị xây lắp (VNĐ, chưa VAT)</Label>
                <CurrencyInput
                  id="constructionValue"
                  value={input.constructionValue}
                  onChange={(v) => handleFieldChange("constructionValue", v)}
                />
                <p className="text-xs text-muted-foreground">
                  Tỷ lệ đang áp dụng — Giám sát: {(input.supervisionRate * 100).toFixed(4)}% · Thiết kế: {(input.designRate * 100).toFixed(4)}%
                </p>
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setInput(prev => ({ ...prev, constructionValue: bidValue }))}
                >
                  Lấy bằng giá trị gói thầu ({formatVND(bidValue)})
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 1b: Doanh thu tính toán từ tỷ lệ phí */}
        {input.constructionValue > 0 && (input.supervisionRate > 0 || input.designRate > 0) && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Doanh thu gói Giám sát & Thiết kế (tính toán)</CardTitle>
              <CardDescription>Tự động tính dựa trên Tổng giá trị xây lắp × Tỷ lệ phí đã nhập</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-md bg-background border border-border p-4 space-y-1">
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Gói Giám sát</div>
                  <div className="text-2xl font-bold text-primary">
                    {formatVND(input.constructionValue * input.supervisionRate)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {input.constructionValue.toLocaleString("vi-VN")} × {(input.supervisionRate * 100).toFixed(4)}%
                  </div>
                </div>
                <div className="rounded-md bg-background border border-border p-4 space-y-1">
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Gói Thiết kế</div>
                  <div className="text-2xl font-bold text-primary">
                    {formatVND(input.constructionValue * input.designRate)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {input.constructionValue.toLocaleString("vi-VN")} × {(input.designRate * 100).toFixed(4)}%
                  </div>
                </div>
                <div className="rounded-md bg-primary/10 border border-primary/30 p-4 space-y-1">
                  <div className="text-xs text-primary font-semibold uppercase tracking-wide">Tổng Doanh thu</div>
                  <div className="text-2xl font-bold text-primary">
                    {formatVND(input.constructionValue * (input.supervisionRate + input.designRate))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Chưa bao gồm VAT {input.vatRate > 0 ? `(VAT: ${formatVND(input.constructionValue * (input.supervisionRate + input.designRate) * input.vatRate)})` : ""}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 2: Cắt lại CĐT */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Tỷ lệ cắt lại Chủ đầu tư (CĐT)</CardTitle>
            <CardDescription>Chi phí chia lại cho các bên liên quan từ giá trị hợp đồng</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="kickbackRateType1">Tỷ lệ cắt lại - Loại 1 (Chỉ CĐT cấp việc - VD: 0.55)</Label>
                <Input
                  id="kickbackRateType1"
                  type="number"
                  step="0.01"
                  value={input.kickbackRateType1}
                  onChange={(e) => handleRateChange("kickbackRateType1", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kickbackRateType2">Tỷ lệ cắt lại - Loại 2 (Lo trọn gói - VD: 0.35)</Label>
                <Input
                  id="kickbackRateType2"
                  type="number"
                  step="0.01"
                  value={input.kickbackRateType2}
                  onChange={(e) => handleRateChange("kickbackRateType2", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Chi phí nhân sự */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Chi phí Nhân sự & BHXH</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
              <div className="space-y-2">
                <Label htmlFor="directorSalaryMonthly">Lương GĐ/tháng (VNĐ)</Label>
                <CurrencyInput
                  id="directorSalaryMonthly"
                  value={input.directorSalaryMonthly}
                  onChange={(v) => handleFieldChange("directorSalaryMonthly", v)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountantSalaryMonthly">Lương Kế toán/tháng (VNĐ)</Label>
                <CurrencyInput
                  id="accountantSalaryMonthly"
                  value={input.accountantSalaryMonthly}
                  onChange={(v) => handleFieldChange("accountantSalaryMonthly", v)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="insuranceRate">Tỷ lệ BHXH Doanh nghiệp đóng (VD: 0.215)</Label>
                <Input
                  id="insuranceRate"
                  type="number"
                  step="0.005"
                  value={input.insuranceRate}
                  onChange={(e) => handleRateChange("insuranceRate", e.target.value)}
                />
              </div>
            </div>

            <Separator className="my-4" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="maxWageFundRate">Trần quỹ lương HĐ Loại 2 (% doanh thu, VD: 0.15)</Label>
                <Input
                  id="maxWageFundRate"
                  type="number"
                  step="0.01"
                  value={input.maxWageFundRate ?? 0.15}
                  onChange={(e) => handleRateChange("maxWageFundRate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="technicianSalaryMonthly">Lương Kỹ sư/tháng (VNĐ)</Label>
                <CurrencyInput
                  id="technicianSalaryMonthly"
                  value={input.technicianSalaryMonthly}
                  onChange={(v) => handleFieldChange("technicianSalaryMonthly", v)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="numTechnicians">Số Kỹ sư thực tế muốn thuê (Loại 2)</Label>
                <Input
                  id="numTechnicians"
                  type="number"
                  value={input.numTechnicians}
                  onChange={(e) => handleRateChange("numTechnicians", e.target.value)}
                />
              </div>
            </div>

            {/* Wage fund constraint display — technicians only */}
            {input.constructionValue > 0 && (input.supervisionRate > 0 || input.designRate > 0) && (
              (() => {
                const revenue = input.constructionValue * (input.supervisionRate + input.designRate);
                const maxWageFundRate = input.maxWageFundRate ?? 0.15;
                const wageFundLimit = revenue * maxWageFundRate;
                const costPerKTV = input.technicianSalaryMonthly * 12 * (1 + input.insuranceRate);
                const maxKTV = wageFundLimit > 0 && costPerKTV > 0 ? Math.floor(wageFundLimit / costPerKTV) : 0;
                const actualTechCost = costPerKTV * input.numTechnicians;
                const exceeded = actualTechCost > wageFundLimit;
                return (
                  <div className={`rounded-lg border p-4 mt-2 ${exceeded ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20" : "border-primary/20 bg-primary/5"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-semibold ${exceeded ? "text-red-700 dark:text-red-400" : "text-primary"}`}>
                        {exceeded ? "⚠ Quỹ lương Kỹ sư Loại 2 — Vượt trần!" : "✓ Quỹ lương Kỹ sư Loại 2 — Trong giới hạn"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">Lương GĐ & Kế toán tính riêng ngoài quỹ lương này</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
                      <div className="rounded-md bg-background border border-border p-3">
                        <div className="text-xs text-muted-foreground mb-1">Trần Quỹ lương Kỹ sư ({(maxWageFundRate * 100).toFixed(0)}% DT)</div>
                        <div className="text-sm font-bold text-primary">{formatVND(wageFundLimit)}</div>
                        <div className="text-xs text-muted-foreground">/năm</div>
                      </div>
                      <div className="rounded-md bg-background border border-border p-3">
                        <div className="text-xs text-muted-foreground mb-1">Chi phí Kỹ sư thực tế ({input.numTechnicians} người, có BH)</div>
                        <div className={`text-sm font-bold ${exceeded ? "text-red-600 dark:text-red-400" : ""}`}>{formatVND(actualTechCost)}</div>
                        <div className="text-xs text-muted-foreground">/năm</div>
                      </div>
                      <div className={`rounded-md border p-3 ${exceeded ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-700" : "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-700"}`}>
                        <div className="text-xs text-muted-foreground mb-1">Kỹ sư tối đa có thể thuê</div>
                        <div className={`text-2xl font-bold ${exceeded ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>{maxKTV}</div>
                        <div className="text-xs text-muted-foreground">người ({formatVND(costPerKTV)}/người/năm)</div>
                      </div>
                    </div>
                    {exceeded && (
                      <div className="mt-3 text-xs text-red-700 dark:text-red-400">
                        Chi phí Kỹ sư ({formatVND(actualTechCost)}/năm) vượt trần <strong>{formatVND(actualTechCost - wageFundLimit)}</strong>. Tối đa cho phép: <strong>{maxKTV} Kỹ sư</strong>.
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </CardContent>
        </Card>

        {/* Section 4: Chi phí cố định */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Chi phí cố định hàng tháng</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
              <div className="space-y-2">
                <Label htmlFor="officeRentMonthly">Thuê văn phòng (VNĐ)</Label>
                <CurrencyInput
                  id="officeRentMonthly"
                  value={input.officeRentMonthly}
                  onChange={(v) => handleFieldChange("officeRentMonthly", v)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="travelEntertainMonthly">Đi lại & Tiếp khách (VNĐ)</Label>
                <CurrencyInput
                  id="travelEntertainMonthly"
                  value={input.travelEntertainMonthly}
                  onChange={(v) => handleFieldChange("travelEntertainMonthly", v)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="otherCostMonthly">Chi phí khác (VNĐ)</Label>
                <CurrencyInput
                  id="otherCostMonthly"
                  value={input.otherCostMonthly}
                  onChange={(v) => handleFieldChange("otherCostMonthly", v)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-2">
                <Label htmlFor="fixedCostDeductibleRate">Tỷ lệ chi phí cố định có hóa đơn hợp lệ (VD: 0.8)</Label>
                <Input
                  id="fixedCostDeductibleRate"
                  type="number"
                  step="0.05"
                  value={input.fixedCostDeductibleRate || 0}
                  onChange={(e) => handleRateChange("fixedCostDeductibleRate", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 5: Thuế & Chi phí khác */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Thuế, VAT & Chi phí Ký hồ sơ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
              <div className="space-y-2">
                <Label htmlFor="corporateTaxRate">Thuế suất TNDN (VD: 0.17 cho DN nhỏ)</Label>
                <Input
                  id="corporateTaxRate"
                  type="number"
                  step="0.01"
                  value={input.corporateTaxRate}
                  onChange={(e) => handleRateChange("corporateTaxRate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vatRate">Thuế suất VAT đầu ra (VD: 0.08)</Label>
                <Input
                  id="vatRate"
                  type="number"
                  step="0.01"
                  value={input.vatRate}
                  onChange={(e) => handleRateChange("vatRate", e.target.value)}
                />
              </div>
            </div>

            <Separator className="my-4" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="signingCostRateType1">Chi phí ký hồ sơ - Loại 1 (VD: 0.05)</Label>
                <Input
                  id="signingCostRateType1"
                  type="number"
                  step="0.01"
                  value={input.signingCostRateType1}
                  onChange={(e) => handleRateChange("signingCostRateType1", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signingCostRateType2">Chi phí ký hồ sơ - Loại 2 (VD: 0.02)</Label>
                <Input
                  id="signingCostRateType2"
                  type="number"
                  step="0.01"
                  value={input.signingCostRateType2}
                  onChange={(e) => handleRateChange("signingCostRateType2", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="fixed bottom-0 left-64 right-0 p-4 bg-background/80 backdrop-blur-md border-t border-border flex justify-end gap-4 z-10 shadow-lg">
        <Button
          onClick={handleSubmit}
          size="lg"
          disabled={calculateMutation.isPending}
          className="px-8"
        >
          {calculateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calculator className="w-4 h-4 mr-2" />}
          Lưu & Tính toán kết quả
        </Button>
      </div>
    </div>
  );
}

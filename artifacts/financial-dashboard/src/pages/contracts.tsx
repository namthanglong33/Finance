import { useState, useEffect, useMemo, useRef } from "react";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useGetFeeRates } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Calculator, Loader2, Pencil, Trash2, Plus, X, Info } from "lucide-react";
import { formatVND } from "@/lib/utils";
import {
  computeGrossProfit, hasSigningCost, hasOutsourceLabor,
  type PackageType, type ContractClass,
} from "@/lib/gross-profit";
import {
  listContracts, addContract, updateContract, deleteContract, computeTotals,
  type StoredContract,
} from "@/lib/contracts-storage";

const GRADES = ["Cấp đặc biệt", "Cấp I", "Cấp II", "Cấp III", "Cấp IV"];
const TYPES = ["Dân dụng", "Công nghiệp", "Giao thông", "Nông nghiệp & môi trường", "Hạ tầng kỹ thuật"];

interface FormState {
  packageType: PackageType;
  contractClass: ContractClass;
  constructionGrade: string;
  constructionType: string;
  designStep: 2 | 3;
  name: string;
  constructionValue: number;
  feeRate: number;
  kickbackRate: number;
  signingRate: number;
  outsourceLaborRate: number;
}

const EMPTY_FORM: FormState = {
  packageType: "design",
  contractClass: 1,
  constructionGrade: "Cấp III",
  constructionType: "Dân dụng",
  designStep: 2,
  name: "",
  constructionValue: 0,
  feeRate: 0,
  kickbackRate: 0.55,
  signingRate: 0.05,
  outsourceLaborRate: 0,
};

export default function ContractsPage() {
  const { toast } = useToast();
  const feeRateMutation = useGetFeeRates();

  const [contracts, setContracts] = useState<StoredContract[]>([]);
  // Giữ form đang nhập dở khi chuyển mục / tải lại trang
  const [form, setForm] = usePersistentState<FormState>("ntl.contracts.form", EMPTY_FORM);
  const [editingId, setEditingId] = usePersistentState<string | null>("ntl.contracts.editingId", null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setContracts(listContracts()); }, []);

  const refresh = () => setContracts(listContracts());
  const totals = useMemo(() => computeTotals(contracts), [contracts]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const rateNum = (v: string) => (v === "" ? 0 : parseFloat(v));

  const contractValue = form.constructionValue * form.feeRate;
  const breakdown = useMemo(
    () =>
      computeGrossProfit({
        packageType: form.packageType,
        contractClass: form.contractClass,
        contractValue,
        kickbackRate: form.kickbackRate,
        signingRate: form.signingRate,
        outsourceLaborRate: form.outsourceLaborRate,
      }),
    [form, contractValue]
  );

  const showSigning = hasSigningCost(form.packageType);
  const showOutsource = hasOutsourceLabor(form.packageType, form.contractClass);

  const handleInterpolate = () => {
    if (!form.constructionValue) {
      toast({ title: "Thiếu giá trị xây lắp", description: "Nhập giá trị xây lắp trước khi nội suy.", variant: "destructive" });
      return;
    }
    feeRateMutation.mutate(
      {
        data: {
          constructionValue: form.constructionValue,
          constructionGrade: form.constructionGrade,
          constructionType: form.constructionType,
          designStep: form.designStep,
        },
      },
      {
        onSuccess: (res) => {
          const rate = form.packageType === "design" ? res.designRate : res.supervisionRate;
          set("feeRate", rate);
          toast({
            title: "Nội suy thành công",
            description: `Tỷ lệ ${form.packageType === "design" ? "Thiết kế" : "Giám sát"}: ${(rate * 100).toFixed(4)}%`,
          });
        },
        onError: () => toast({ title: "Lỗi", description: "Không lấy được tỷ lệ phí.", variant: "destructive" }),
      }
    );
  };

  const resetForm = () => { setForm(EMPTY_FORM); setEditingId(null); };

  const handleAddToTotal = () => {
    if (contractValue <= 0) {
      toast({ title: "Chưa có giá trị hợp đồng", description: "Nhập giá trị xây lắp và tỷ lệ phí trước.", variant: "destructive" });
      return;
    }
    setConfirmOpen(true);
  };

  const confirmSave = () => {
    const payload = {
      packageType: form.packageType,
      contractClass: form.contractClass,
      constructionGrade: form.constructionGrade,
      constructionType: form.constructionType,
      designStep: form.designStep,
      name: form.name.trim(),
      constructionValue: form.constructionValue,
      feeRate: form.feeRate,
      kickbackRate: form.kickbackRate,
      signingRate: showSigning ? form.signingRate : 0,
      outsourceLaborRate: showOutsource ? form.outsourceLaborRate : 0,
      contractValue,
      grossProfit: breakdown.grossProfit,
    };
    if (editingId) {
      updateContract(editingId, payload);
      toast({ title: "Đã cập nhật hợp đồng", description: "Tổng đã được tính lại." });
    } else {
      addContract(payload);
      toast({ title: "Đã cộng vào tổng", description: `Lãi gộp: ${formatVND(breakdown.grossProfit)}` });
    }
    setConfirmOpen(false);
    resetForm();
    refresh();
  };

  const handleEdit = (c: StoredContract) => {
    setForm({
      packageType: c.packageType,
      contractClass: c.contractClass,
      constructionGrade: c.constructionGrade,
      constructionType: c.constructionType,
      designStep: c.designStep ?? 3,
      name: c.name,
      constructionValue: c.constructionValue,
      feeRate: c.feeRate,
      kickbackRate: c.kickbackRate,
      signingRate: c.signingRate,
      outsourceLaborRate: c.outsourceLaborRate,
    });
    setEditingId(c.id);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteContract(deleteId);
      if (editingId === deleteId) resetForm();
      setDeleteId(null);
      refresh();
      toast({ title: "Đã xóa hợp đồng" });
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto pb-12">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Hợp đồng thực tế</h1>
        <p className="text-muted-foreground mt-1">
          Nhập từng hợp đồng, tính lãi gộp đơn lẻ và cộng dồn vào tổng doanh thu thực &amp; tổng lãi gộp.
        </p>
      </div>

      {/* KPI tổng */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Số hợp đồng</CardDescription></CardHeader>
          <CardContent><div className="text-3xl font-bold">{totals.count}</div></CardContent>
        </Card>
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2"><CardDescription>Tổng doanh thu thực (Σ giá trị HĐ)</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">{formatVND(totals.totalRevenue)}</div></CardContent>
        </Card>
        <Card className="border-green-500/30 bg-green-50 dark:bg-green-950/20">
          <CardHeader className="pb-2"><CardDescription>Tổng lãi gộp (Σ lãi gộp)</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatVND(totals.totalGrossProfit)}</div></CardContent>
        </Card>
      </div>

      {/* Form nhập hợp đồng */}
      <Card ref={formRef} className={editingId ? "border-amber-400/60" : ""}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">
                {editingId ? "Chỉnh sửa hợp đồng" : "Thêm hợp đồng mới"}
              </CardTitle>
              <CardDescription>
                Chọn loại gói, tiêu chí công trình, loại HĐ; nhập giá trị xây lắp rồi nội suy tỷ lệ phí.
              </CardDescription>
            </div>
            {editingId && (
              <Button variant="ghost" size="sm" onClick={resetForm}>
                <X className="w-4 h-4 mr-1" /> Hủy sửa
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Lựa chọn */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-2">
              <Label>Loại gói tư vấn</Label>
              <Select value={form.packageType} onValueChange={(v) => set("packageType", v as PackageType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="design">Thiết kế</SelectItem>
                  <SelectItem value="supervision">Giám sát</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Loại công trình: cần cho cả Thiết kế (Bảng 2.7-2.15) lẫn Giám sát (Bảng 2.24) */}
            <div className="space-y-2">
              <Label>Loại công trình {form.packageType === "design" ? "(Bảng 2.7–2.15)" : "(Bảng 2.24)"}</Label>
              <Select value={form.constructionType} onValueChange={(v) => set("constructionType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Cấp công trình: chỉ gói Thiết kế mới tra theo cấp */}
            {form.packageType === "design" && (
              <div className="space-y-2">
                <Label>Cấp công trình</Label>
                <Select value={form.constructionGrade} onValueChange={(v) => set("constructionGrade", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Bước thiết kế: quyết định dùng Bảng lẻ (3 bước) hay Bảng chẵn (2 bước) */}
            {form.packageType === "design" && (
              <div className="space-y-2">
                <Label>Bước thiết kế</Label>
                <Select
                  value={String(form.designStep)}
                  onValueChange={(v) => set("designStep", Number(v) as 2 | 3)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 bước (chỉ BVTC)</SelectItem>
                    <SelectItem value="3">3 bước (TK kỹ thuật + BVTC)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Loại hợp đồng</Label>
              <Select
                value={String(form.contractClass)}
                onValueChange={(v) => {
                  const cls = Number(v) as ContractClass;
                  // Tự nhảy tỷ lệ cắt lại CĐT theo loại HĐ: L1 → 0.55, L2 → 0.35
                  setForm((p) => ({ ...p, contractClass: cls, kickbackRate: cls === 2 ? 0.35 : 0.55 }));
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Loại 1 (Ký và đóng dấu)</SelectItem>
                  <SelectItem value="2">Loại 2 (Lo trọn gói)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Tên / ghi chú hợp đồng (tùy chọn)</Label>
            <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="VD: Gói TK trường THCS X" />
          </div>

          <Separator />

          {/* Giá trị & tỷ lệ */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-2">
              <Label htmlFor="cv">Giá trị xây lắp (VNĐ)</Label>
              <CurrencyInput id="cv" value={form.constructionValue} onChange={(v) => set("constructionValue", v)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feeRate">Tỷ lệ phí (hệ số)</Label>
              <Input id="feeRate" type="number" step="0.00001" value={form.feeRate}
                onChange={(e) => set("feeRate", rateNum(e.target.value))} />
            </div>
            <div className="flex items-end">
              <Button type="button" variant="secondary" className="w-full"
                onClick={handleInterpolate} disabled={feeRateMutation.isPending}>
                {feeRateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calculator className="w-4 h-4 mr-2" />}
                Nội suy tỷ lệ phí
              </Button>
            </div>
          </div>

          <div className="rounded-md bg-muted/50 border border-border p-3 text-sm">
            <span className="text-muted-foreground">Giá trị hợp đồng (phí tư vấn) = xây lắp × tỷ lệ = </span>
            <span className="font-bold text-primary">{formatVND(contractValue)}</span>
            <span className="text-muted-foreground"> ({(form.feeRate * 100).toFixed(4)}%)</span>
          </div>

          {/* Lưu ý: trường hợp chi phí thiết bị ≥ 50% (gói Thiết kế) */}
          {form.packageType === "design" && (
            <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/20 dark:text-amber-300">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <span className="font-semibold">Lưu ý (TT 38/2026/TT-BXD):</span> Nếu <strong>chi phí thiết bị ≥ 50%</strong> tổng
                (chi phí xây dựng + chi phí thiết bị) trong dự toán, phí thiết kế <strong>không</strong> tính theo cách trên mà
                xác định bằng: <em>(tỷ lệ % Bảng 2.7/2.8 × chi phí xây dựng) + (tỷ lệ % Bảng DD1 × chi phí thiết bị)</em>, đều chưa VAT.
                Trường hợp này phần mềm <strong>chưa tự tính</strong> — cần tính riêng theo Bảng DD1.
              </div>
            </div>
          )}

          {/* Các khoản trừ */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-2">
              <Label htmlFor="kb">Tỷ lệ cắt lại CĐT (hệ số)</Label>
              <Input id="kb" type="number" step="0.01" value={form.kickbackRate}
                onChange={(e) => set("kickbackRate", rateNum(e.target.value))} />
            </div>
            {showSigning && (
              <div className="space-y-2">
                <Label htmlFor="sc">Tỷ lệ ký hồ sơ (hệ số)</Label>
                <Input id="sc" type="number" step="0.01" value={form.signingRate}
                  onChange={(e) => set("signingRate", rateNum(e.target.value))} />
              </div>
            )}
            {showOutsource && (
              <div className="space-y-2">
                <Label htmlFor="ol">Tỷ lệ nhân công thuê ngoài (hệ số)</Label>
                <Input id="ol" type="number" step="0.01" value={form.outsourceLaborRate}
                  onChange={(e) => set("outsourceLaborRate", rateNum(e.target.value))} />
              </div>
            )}
          </div>

          {/* Kết quả lãi gộp */}
          {contractValue > 0 && (
            <div className="rounded-lg border border-green-500/30 bg-green-50 dark:bg-green-950/20 p-4">
              <div className="text-sm font-semibold text-green-700 dark:text-green-400 mb-3">Lãi gộp hợp đồng đơn lẻ</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <BreakdownItem label="Giá trị HĐ" value={breakdown.contractValue} />
                <BreakdownItem label="− Cắt lại CĐT" value={-breakdown.kickback} />
                {showSigning && <BreakdownItem label="− Ký hồ sơ" value={-breakdown.signingCost} />}
                {showOutsource && <BreakdownItem label="− Nhân công thuê ngoài" value={-breakdown.outsourceLabor} />}
              </div>
              <Separator className="my-3" />
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">Lãi gộp · Biên {(breakdown.grossMargin * 100).toFixed(1)}%</div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatVND(breakdown.grossProfit)}</div>
                </div>
                <Button onClick={handleAddToTotal} size="lg">
                  <Plus className="w-4 h-4 mr-2" />
                  {editingId ? "Lưu thay đổi" : "Cộng vào tổng"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danh sách hợp đồng */}
      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Danh sách hợp đồng đã cộng ({contracts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {contracts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Chưa có hợp đồng nào. Thêm ở form phía trên.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Hợp đồng</th>
                    <th className="py-2 px-3 font-medium">Gói / Loại</th>
                    <th className="py-2 px-3 font-medium text-right">Giá trị HĐ</th>
                    <th className="py-2 px-3 font-medium text-right">Lãi gộp</th>
                    <th className="py-2 pl-3 font-medium text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="py-2.5 pr-3">
                        <div className="font-medium">{c.name || <span className="text-muted-foreground italic">(không tên)</span>}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.packageType === "design"
                            ? `${c.constructionType} · ${c.constructionGrade} · ${c.designStep ?? 3} bước`
                            : c.constructionType}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant={c.packageType === "design" ? "default" : "secondary"}>
                          {c.packageType === "design" ? "Thiết kế" : "Giám sát"}
                        </Badge>
                        <span className="ml-1 text-xs text-muted-foreground">L{c.contractClass}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right">{formatVND(c.contractValue)}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-green-600 dark:text-green-400">{formatVND(c.grossProfit)}</td>
                      <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(c)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(c.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-semibold">
                    <td className="py-2.5 pr-3" colSpan={2}>Tổng cộng</td>
                    <td className="py-2.5 px-3 text-right text-primary">{formatVND(totals.totalRevenue)}</td>
                    <td className="py-2.5 px-3 text-right text-green-600 dark:text-green-400">{formatVND(totals.totalGrossProfit)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog xác nhận cộng vào tổng */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{editingId ? "Lưu thay đổi hợp đồng?" : "Cộng hợp đồng này vào tổng?"}</AlertDialogTitle>
            <AlertDialogDescription>
              Lãi gộp: <strong>{formatVND(breakdown.grossProfit)}</strong> · Giá trị HĐ: <strong>{formatVND(contractValue)}</strong>.
              {editingId ? " Tổng sẽ được tính lại." : " Sẽ cộng vào tổng doanh thu thực và tổng lãi gộp."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Không</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSave}>Có</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog xác nhận xóa */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa hợp đồng?</AlertDialogTitle>
            <AlertDialogDescription>Hành động này không thể hoàn tác. Tổng sẽ được tính lại.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BreakdownItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded bg-background border border-border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-semibold ${value < 0 ? "text-red-600 dark:text-red-400" : ""}`}>{formatVND(value)}</div>
    </div>
  );
}

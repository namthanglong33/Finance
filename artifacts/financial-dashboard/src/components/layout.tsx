import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Calculator, FileText, TrendingUp, Sun, Moon, Table2,
  FileSpreadsheet, Briefcase, ChevronDown, RotateCcw, Sparkles,
} from "lucide-react";
import { useState, useEffect, type ComponentType } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { resetAllAppData } from "@/lib/reset-app";

interface NavLeaf {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

interface NavGroup {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  children: NavLeaf[];
}

type NavEntry = NavLeaf | (NavGroup & { group: true });

const NAV: NavEntry[] = [
  {
    group: true,
    id: "business-plan",
    label: "Kế hoạch kinh doanh",
    icon: Briefcase,
    children: [
      { href: "/", label: "Tổng quan", icon: LayoutDashboard },
      { href: "/input", label: "Nhập thông số", icon: Calculator },
      { href: "/calculation", label: "Tính Toán", icon: Table2 },
      { href: "/results", label: "Kết quả", icon: FileText },
      { href: "/optimize", label: "Tối ưu thuế", icon: TrendingUp },
      { href: "/optimized-results", label: "Kết quả sau tối ưu thuế", icon: Sparkles },
    ],
  },
  { href: "/contracts", label: "Hợp đồng thực tế", icon: FileSpreadsheet },
];

function isGroup(entry: NavEntry): entry is NavGroup & { group: true } {
  return (entry as { group?: boolean }).group === true;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isDark, setIsDark] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const handleReset = () => {
    resetAllAppData();
    window.location.reload();
  };

  const toggleGroup = (id: string) => setCollapsed((p) => ({ ...p, [id]: !p[id] }));

  const leafClass = (active: boolean, indented = false) =>
    `flex items-center px-3 py-2.5 rounded-md text-sm font-medium cursor-pointer transition-colors ${
      indented ? "pl-9" : ""
    } ${
      active
        ? "bg-sidebar-accent text-sidebar-accent-foreground"
        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
    }`;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <div className="w-64 border-r bg-sidebar text-sidebar-foreground flex flex-col print:hidden">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center mr-3">
            <TrendingUp className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">Nam Thang Long</h1>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {NAV.map((entry) => {
            if (!isGroup(entry)) {
              const active = location === entry.href;
              return (
                <Link key={entry.href} href={entry.href}>
                  <div className={leafClass(active)}>
                    <entry.icon className={`w-4 h-4 mr-3 ${active ? "text-primary" : "text-muted-foreground"}`} />
                    {entry.label}
                  </div>
                </Link>
              );
            }

            const groupActive = entry.children.some((c) => c.href === location);
            const isCollapsed = collapsed[entry.id] ?? false;
            return (
              <div key={entry.id} className="space-y-1">
                <button
                  onClick={() => toggleGroup(entry.id)}
                  className={`w-full flex items-center px-3 py-2.5 rounded-md text-sm font-semibold transition-colors ${
                    groupActive
                      ? "text-sidebar-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}
                >
                  <entry.icon className={`w-4 h-4 mr-3 ${groupActive ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="flex-1 text-left">{entry.label}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-muted-foreground transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                  />
                </button>
                {!isCollapsed && (
                  <div className="space-y-1">
                    {entry.children.map((child) => {
                      const active = location === child.href;
                      return (
                        <Link key={child.href} href={child.href}>
                          <div className={leafClass(active, true)}>
                            <child.icon className={`w-4 h-4 mr-3 ${active ? "text-primary" : "text-muted-foreground"}`} />
                            {child.label}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border space-y-2">
          <button
            onClick={() => setIsDark(!isDark)}
            className="flex items-center justify-center w-full py-2 px-3 rounded-md text-sm font-medium bg-sidebar-accent/50 hover:bg-sidebar-accent transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
            {isDark ? "Giao diện Sáng" : "Giao diện Tối"}
          </button>
          <button
            onClick={() => setResetOpen(true)}
            className="flex items-center justify-center w-full py-2 px-3 rounded-md text-sm font-medium text-destructive border border-destructive/30 hover:bg-destructive/10 transition-colors"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Đặt lại toàn bộ
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-background print:overflow-visible">
        {children}
      </div>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Đặt lại toàn bộ dữ liệu?</AlertDialogTitle>
            <AlertDialogDescription>
              Thao tác này sẽ xóa <strong>tất cả</strong> dữ liệu đã nhập đang lưu trong trình duyệt:
              thông số tài chính, thông tin gói thầu, form &amp; <strong>toàn bộ hợp đồng đã lưu</strong>,
              và cấu hình tối ưu thuế. <strong>Không thể hoàn tác.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Xóa hết &amp; nhập lại
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

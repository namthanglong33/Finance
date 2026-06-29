import { Link, useLocation } from "wouter";
import { LayoutDashboard, Calculator, FileText, TrendingUp, Sun, Moon, Table2 } from "lucide-react";
import { useState, useEffect } from "react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const navItems = [
    { href: "/", label: "Tổng quan", icon: LayoutDashboard },
    { href: "/input", label: "Nhập thông số", icon: Calculator },
    { href: "/calculation", label: "Tính Toán", icon: Table2 },
    { href: "/results", label: "Kết quả", icon: FileText },
    { href: "/optimize", label: "Tối ưu thuế", icon: TrendingUp },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <div className="w-64 border-r bg-sidebar text-sidebar-foreground flex flex-col print:hidden">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center mr-3">
            <TrendingUp className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">Nam Thang Long</h1>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const active = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center px-3 py-2.5 rounded-md text-sm font-medium cursor-pointer transition-colors ${
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}
                >
                  <item.icon className={`w-4 h-4 mr-3 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <button
            onClick={() => setIsDark(!isDark)}
            className="flex items-center justify-center w-full py-2 px-3 rounded-md text-sm font-medium bg-sidebar-accent/50 hover:bg-sidebar-accent transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
            {isDark ? "Giao diện Sáng" : "Giao diện Tối"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-background print:overflow-visible">
        {children}
      </div>
    </div>
  );
}

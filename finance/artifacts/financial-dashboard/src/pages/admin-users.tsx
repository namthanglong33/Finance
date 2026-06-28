import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck, User, UserPlus, Lock, Unlock, KeyRound,
  Loader2, Eye, EyeOff, RefreshCw, ShieldAlert,
} from "lucide-react";
import { useLocation } from "wouter";

interface UserRecord {
  id: number;
  username: string;
  role: "admin" | "user";
  isActive: boolean;
  createdAt: string;
  createdBy: string | null;
}

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, { credentials: "include", ...options });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

function useUsers() {
  return useQuery<UserRecord[]>({
    queryKey: ["admin-users"],
    queryFn: () => apiFetch("/api/auth/users"),
  });
}

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [showPwd, setShowPwd] = useState(false);

  const [changePwdId, setChangePwdId] = useState<number | null>(null);
  const [newPwd, setNewPwd] = useState("");
  const [showNewPwd, setShowNewPwd] = useState(false);

  const { data: users, isLoading, refetch } = useUsers();

  const createMutation = useMutation({
    mutationFn: (body: { username: string; password: string; role: string }) =>
      apiFetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: (newUser: UserRecord) => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setUsername("");
      setPassword("");
      setRole("user");
      toast({ title: "Tạo tài khoản thành công", description: `Đã tạo tài khoản "${newUser.username}"` });
    },
    onError: (e: Error) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiFetch(`/api/auth/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: vars.isActive ? "Đã kích hoạt tài khoản" : "Đã khóa tài khoản" });
    },
    onError: (e: Error) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  const changePwdMutation = useMutation({
    mutationFn: ({ id, password: pwd }: { id: number; password: string }) =>
      apiFetch(`/api/auth/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      }),
    onSuccess: () => {
      setChangePwdId(null);
      setNewPwd("");
      toast({ title: "Đã đổi mật khẩu" });
    },
    onError: (e: Error) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <ShieldAlert className="w-16 h-16 text-muted-foreground/30" />
        <p className="text-muted-foreground text-lg">Bạn không có quyền truy cập trang này</p>
        <Button variant="outline" onClick={() => setLocation("/")}>Quay lại</Button>
      </div>
    );
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    createMutation.mutate({ username: username.trim(), password, role });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto pb-16 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quản lý người dùng</h1>
          <p className="text-muted-foreground mt-1">Tạo và quản lý tài khoản cho người dùng hệ thống</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </div>

      {/* Create user form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="w-5 h-5 text-primary" />
            Tạo tài khoản mới
          </CardTitle>
          <CardDescription>Tạo tài khoản và cấp cho người dùng</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div className="space-y-1.5">
              <Label>Tên tài khoản</Label>
              <Input
                placeholder="vd: nguyen.van.a"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Mật khẩu</Label>
              <div className="relative">
                <Input
                  type={showPwd ? "text" : "password"}
                  placeholder="Mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-9"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Vai trò</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "user" | "admin")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Người dùng</SelectItem>
                  <SelectItem value="admin">Quản trị viên</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={createMutation.isPending} className="w-full">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
              Tạo tài khoản
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* User list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="w-5 h-5 text-primary" />
            Danh sách tài khoản
            {users && (
              <Badge variant="secondary" className="ml-1">{users.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>Quản lý trạng thái và mật khẩu của từng tài khoản</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !users || users.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Chưa có tài khoản nào</p>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div
                  key={u.id}
                  className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border transition-colors ${
                    u.isActive ? "bg-card" : "bg-muted/30 opacity-70"
                  }`}
                >
                  {/* Icon + info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      u.role === "admin" ? "bg-primary/10" : "bg-muted"
                    }`}>
                      {u.role === "admin"
                        ? <ShieldCheck className="w-5 h-5 text-primary" />
                        : <User className="w-5 h-5 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{u.username}</span>
                        <Badge variant={u.role === "admin" ? "default" : "secondary"} className="text-xs">
                          {u.role === "admin" ? "Admin" : "User"}
                        </Badge>
                        <Badge variant={u.isActive ? "outline" : "destructive"} className="text-xs">
                          {u.isActive ? "Hoạt động" : "Đã khóa"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Tạo lúc {new Date(u.createdAt).toLocaleDateString("vi-VN")}
                        {u.createdBy ? ` bởi ${u.createdBy}` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Change password inline */}
                    {changePwdId === u.id ? (
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Input
                            type={showNewPwd ? "text" : "password"}
                            placeholder="Mật khẩu mới"
                            value={newPwd}
                            onChange={(e) => setNewPwd(e.target.value)}
                            className="h-8 text-sm pr-8 w-36"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPwd(!showNewPwd)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                            tabIndex={-1}
                          >
                            {showNewPwd ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        </div>
                        <Button
                          size="sm"
                          className="h-8"
                          disabled={!newPwd || changePwdMutation.isPending}
                          onClick={() => changePwdMutation.mutate({ id: u.id, password: newPwd })}
                        >
                          {changePwdMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Lưu"}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => { setChangePwdId(null); setNewPwd(""); }}>
                          Hủy
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => { setChangePwdId(u.id); setNewPwd(""); }}
                      >
                        <KeyRound className="w-3 h-3 mr-1.5" />
                        Đổi mật khẩu
                      </Button>
                    )}

                    {/* Lock / Unlock — can't lock yourself */}
                    {u.username !== user?.username && (
                      <Button
                        size="sm"
                        variant={u.isActive ? "outline" : "default"}
                        className={`h-8 text-xs ${u.isActive ? "text-destructive hover:bg-destructive/10 border-destructive/30" : ""}`}
                        disabled={toggleMutation.isPending}
                        onClick={() => toggleMutation.mutate({ id: u.id, isActive: !u.isActive })}
                      >
                        {u.isActive
                          ? <><Lock className="w-3 h-3 mr-1.5" />Khóa</>
                          : <><Unlock className="w-3 h-3 mr-1.5" />Mở khóa</>}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

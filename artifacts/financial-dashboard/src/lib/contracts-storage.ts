// Lớp lưu trữ hợp đồng thực tế (Phase 1: localStorage).
// Phase 2: thay toàn bộ thân các hàm bằng lời gọi API /api/contracts mà KHÔNG đổi chữ ký,
// để UI không phải sửa.

import type { PackageType, ContractClass } from "./gross-profit";

const STORAGE_KEY = "ntl.contracts.v1";

export interface StoredContract {
  id: string;
  createdAt: number;
  updatedAt: number;
  // ── Lựa chọn ──
  packageType: PackageType; // design | supervision
  contractClass: ContractClass; // 1 | 2
  /** Cấp công trình (gói Thiết kế) — vd "Cấp III" */
  constructionGrade: string;
  /** Loại công trình (gói Giám sát) — "Dân dụng" | "Giao thông" */
  constructionType: string;
  /** Số bước thiết kế (gói Thiết kế): 2 = chỉ BVTC | 3 = TKKT + BVTC */
  designStep: 2 | 3;
  /** Tên/ghi chú nhận diện hợp đồng (tùy chọn) */
  name: string;
  // ── Số liệu nhập ──
  constructionValue: number; // giá trị xây lắp
  feeRate: number; // tỷ lệ phí nội suy (hệ số)
  kickbackRate: number;
  signingRate: number;
  outsourceLaborRate: number;
  // ── Kết quả chốt tại thời điểm lưu ──
  contractValue: number; // = constructionValue × feeRate
  grossProfit: number;
}

export type NewContract = Omit<StoredContract, "id" | "createdAt" | "updatedAt">;

function read(): StoredContract[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: StoredContract[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function listContracts(): StoredContract[] {
  return read().sort((a, b) => b.createdAt - a.createdAt);
}

export function addContract(data: NewContract): StoredContract {
  const now = Date.now();
  const item: StoredContract = { ...data, id: uid(), createdAt: now, updatedAt: now };
  const items = read();
  items.push(item);
  write(items);
  return item;
}

export function updateContract(id: string, data: NewContract): StoredContract | null {
  const items = read();
  const idx = items.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...data, updatedAt: Date.now() };
  write(items);
  return items[idx];
}

export function deleteContract(id: string): void {
  write(read().filter((c) => c.id !== id));
}

export interface ContractTotals {
  count: number;
  totalRevenue: number; // Σ giá trị hợp đồng (doanh thu thực)
  totalGrossProfit: number; // Σ lãi gộp
}

export function computeTotals(items: StoredContract[]): ContractTotals {
  return items.reduce<ContractTotals>(
    (acc, c) => ({
      count: acc.count + 1,
      totalRevenue: acc.totalRevenue + c.contractValue,
      totalGrossProfit: acc.totalGrossProfit + c.grossProfit,
    }),
    { count: 0, totalRevenue: 0, totalGrossProfit: 0 }
  );
}

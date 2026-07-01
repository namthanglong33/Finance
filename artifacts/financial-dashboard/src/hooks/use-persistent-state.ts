import { useState, useEffect, type Dispatch, type SetStateAction } from "react";

/** useState nhưng lưu giá trị vào localStorage theo `key`.
 *  Giữ lại dữ liệu khi chuyển trang (wouter unmount) và khi tải lại trang.
 *  Dùng thay thế trực tiếp cho useState (cùng chữ ký). */
export function usePersistentState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* localStorage đầy/không khả dụng — bỏ qua */
    }
  }, [key, state]);

  return [state, setState];
}

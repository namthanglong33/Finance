// Xóa toàn bộ dữ liệu phần mềm lưu trong trình duyệt (localStorage) để nhập lại từ đầu.
// Gồm: thông số tài chính, form & danh sách hợp đồng, thông tin gói thầu, cấu hình tối ưu thuế.

const EXTRA_KEYS = ["ct7_config_v2"]; // key trang Tối ưu thuế (không theo tiền tố ntl.)

export function resetAllAppData(): void {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("ntl.") || EXTRA_KEYS.includes(key))) {
        toRemove.push(key);
      }
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* localStorage không khả dụng — bỏ qua */
  }
}

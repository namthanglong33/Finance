import * as React from "react";
import { cn } from "@/lib/utils";

interface CurrencyInputProps extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
}

/** Input hiển thị số có dấu chấm ngăn cách hàng nghìn (định dạng vi-VN).
 *  Khi focus: cho nhập số thô. Khi blur: format lại với dấu chấm. */
const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, suffix = "₫", className, ...props }, ref) => {
    const [focused, setFocused] = React.useState(false);
    const [raw, setRaw] = React.useState(value === 0 ? "" : String(value));

    // Đồng bộ khi value thay đổi từ bên ngoài (ví dụ nội suy tỷ lệ)
    React.useEffect(() => {
      if (!focused) {
        setRaw(value === 0 ? "" : String(value));
      }
    }, [value, focused]);

    const formatted = React.useMemo(() => {
      if (!value && value !== 0) return "";
      return new Intl.NumberFormat("vi-VN").format(value);
    }, [value]);

    const handleFocus = () => {
      setFocused(true);
      setRaw(value === 0 ? "" : String(value));
    };

    const handleBlur = () => {
      setFocused(false);
      const num = parseFloat(raw.replace(/[^\d.]/g, ""));
      onChange(isNaN(num) ? 0 : num);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value.replace(/[^\d]/g, "");
      setRaw(v);
      const num = parseFloat(v);
      onChange(isNaN(num) ? 0 : num);
    };

    return (
      <div className="relative flex items-center">
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          value={focused ? raw : formatted}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-8 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            className
          )}
          {...props}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-2.5 text-sm text-muted-foreground select-none">
            {suffix}
          </span>
        )}
      </div>
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };

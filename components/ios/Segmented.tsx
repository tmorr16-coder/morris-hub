"use client";

/** iOS segmented control. Controlled: pass `value` + `onChange`. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  style,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className="ios-segmented" role="tablist" aria-label={ariaLabel} style={style}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

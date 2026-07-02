// SF-symbol-style inline glyphs for the iOS design system. Stroke-based,
// 24×24 viewBox, currentColor — size via CSS (width/height on the <svg>).
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (props: P) => ({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  // Default to 1em so font-size controls the glyph size; CSS width/height or a
  // width/height prop still override. Prevents unsized SVGs rendering huge.
  width: "1em",
  height: "1em",
  ...props,
});

export const CalendarIcon = (p: P) => (
  <svg {...base(p)}><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 9h17M8 3v3M16 3v3" /></svg>
);
export const BellIcon = (p: P) => (
  <svg {...base(p)}><path d="M6 9a6 6 0 1 1 12 0c0 4 1.2 5.2 2 6H4c.8-.8 2-2 2-6Z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
);
export const HeartIcon = (p: P) => (
  <svg {...base(p)}><path d="M12 20s-7-4.6-9.2-9C1.3 8 2.8 4.5 6 4.5c2 0 3.2 1.2 4 2.4.8-1.2 2-2.4 4-2.4 3.2 0 4.7 3.5 3.2 6.5C19 15.4 12 20 12 20Z" /></svg>
);
export const WalletIcon = (p: P) => (
  <svg {...base(p)}><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10h18M16.5 14.5h.01" /></svg>
);
export const PeopleIcon = (p: P) => (
  <svg {...base(p)}><circle cx="8.5" cy="8" r="3" /><path d="M3 19a5.5 5.5 0 0 1 11 0" /><path d="M16 6a3 3 0 0 1 0 6M17 14.2A5.5 5.5 0 0 1 21 19.5" /></svg>
);
export const PersonIcon = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="8" r="3.4" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></svg>
);
export const TodayIcon = (p: P) => (
  <svg {...base(p)}><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 9h17M8 3v3M16 3v3" /><path d="M7.5 13.5h4" /></svg>
);
export const PlusIcon = (p: P) => (
  <svg {...base(p)} strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
);
export const EllipsisIcon = (p: P) => (
  <svg {...base(p)}><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" /></svg>
);
export const SparkleIcon = (p: P) => (
  <svg {...base(p)}><path d="M12 3.5l1.7 4.3L18 9.5l-4.3 1.7L12 15.5l-1.7-4.3L6 9.5l4.3-1.7L12 3.5Z" /><path d="M18.5 15l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" /></svg>
);
export const PillIcon = (p: P) => (
  <svg {...base(p)}><rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-45 12 12)" /><path d="M8.8 8.8l6.4 6.4" /></svg>
);
export const DumbbellIcon = (p: P) => (
  <svg {...base(p)}><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" /></svg>
);
export const BriefcaseIcon = (p: P) => (
  <svg {...base(p)}><rect x="3" y="7.5" width="18" height="12" rx="2.5" /><path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5M3 12.5h18" /></svg>
);
export const ChevronRight = (p: P) => (
  <svg {...base(p)} strokeWidth={2.2}><path d="M9 5l7 7-7 7" /></svg>
);
export const ComposeIcon = (p: P) => (
  <svg {...base(p)}><path d="M4 20h16M6 16.5l9.5-9.5a2 2 0 0 1 3 3L9 19.5l-4 1 1-4Z" /></svg>
);

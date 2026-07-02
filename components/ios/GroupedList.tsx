import type { ReactNode } from "react";

/**
 * A grouped-inset list section: an optional uppercase footnote header, the
 * rounded white card of cells, and an optional footer note. Server-safe.
 */
export function Group({
  header,
  footer,
  children,
  id,
  style,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  id?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section className="ios-group" aria-labelledby={id} style={style}>
      {header != null && (
        <h2 id={id} className="ios-group-header">
          {header}
        </h2>
      )}
      <div className="ios-list">{children}</div>
      {footer != null && <p className="ios-group-footer ios-footnote">{footer}</p>}
    </section>
  );
}

/** A bare rounded card (cells with no section header). */
export function List({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="ios-list" style={{ margin: "0 var(--ios-gutter)", ...style }}>
      {children}
    </div>
  );
}

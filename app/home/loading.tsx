/**
 * Route-level Suspense boundary for Today.
 *
 * `app/home/page.tsx` is `force-dynamic` and does a lot of sequential work
 * before it can return, so navigating to Today used to sit on the previous
 * screen with no feedback until the whole thing resolved. Next renders this in
 * its place the moment navigation starts.
 *
 * The scope matters: nothing above this route sets `data-ui="ios"` (Today gets
 * it from HomeClient's IOSScreen, which hasn't rendered yet), so this sets it
 * itself — without it the --ios-* tokens below resolve to nothing.
 */
function Block({ height, width, radius = 8 }: { height: number; width: string; radius?: number }) {
  return <div style={{ height, width, borderRadius: radius, background: "var(--ios-fill)" }} />;
}

export default function Loading() {
  return (
    <div data-ui="ios">
      <main className="ios-scroll ios-skeleton" style={{ padding: "20px var(--ios-gutter)" }} aria-busy="true" aria-label="Loading Today">
        {/* Greeting + date */}
        <Block height={13} width="34%" />
        <div style={{ height: 10 }} />
        <Block height={30} width="58%" />

        {/* 2×2 glance grid */}
        <div className="ios-glance" style={{ marginTop: 22 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="ios-tile"
              style={{ background: "var(--ios-cell)", pointerEvents: "none" }}
            >
              <Block height={11} width="52%" radius={4} />
              <div style={{ height: 9 }} />
              <Block height={22} width="66%" radius={6} />
              <div style={{ height: 7 }} />
              <Block height={11} width="80%" radius={4} />
            </div>
          ))}
        </div>

        {/* Two list groups underneath */}
        {[0, 1].map((g) => (
          <div key={g} style={{ marginTop: 26 }}>
            <Block height={11} width="30%" radius={4} />
            <div
              style={{
                marginTop: 10,
                background: "var(--ios-cell)",
                borderRadius: "var(--ios-radius-tile)",
                padding: "4px 14px",
              }}
            >
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "13px 0",
                    borderTop: i === 0 ? "none" : "0.5px solid var(--ios-separator)",
                  }}
                >
                  <Block height={26} width="26px" radius={7} />
                  <div style={{ flex: 1 }}>
                    <Block height={13} width={`${76 - i * 13}%`} radius={4} />
                    <div style={{ height: 7 }} />
                    <Block height={11} width={`${48 - i * 8}%`} radius={4} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}

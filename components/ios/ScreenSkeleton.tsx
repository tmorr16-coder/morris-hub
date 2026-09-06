// The shape of a screen, shown while the real one is being rendered.
//
// Only /home and one Bible route had a loading state. Every other module
// transition rendered nothing at all until the server came back — the browser
// simply sat on the previous screen — which is what a pause between pages
// actually was. Next renders this the moment a navigation starts.
//
// Deliberately not animated. The version on Today pulses, and a pulse that runs
// for the length of a slow render reads as flashing rather than as progress. A
// still outline says "something is coming" without asking for attention.
//
// And it holds itself back for a quarter of a second. Next renders a loading
// state the instant a navigation starts, so a fast transition flashed a
// wireframe and replaced it almost immediately — visible often enough to read
// as the app stuttering rather than as feedback. Starting at zero opacity and
// fading in on a delay means a render that beats the delay shows nothing at
// all, and only a genuinely slow one draws the outline.
//
// It renders only the scrolling area: every module layout already opens the
// `data-ui="ios"` scope and draws the tab bar around it.

function Block({ h, w, r = 8 }: { h: number; w: string; r?: number }) {
  return <div style={{ height: h, width: w, borderRadius: r, background: "var(--ios-fill)" }} />;
}

function Row({ shrink }: { shrink: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 0" }}>
      <Block h={30} w="30px" r={9} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
        <Block h={13} w={`${72 - shrink * 11}%`} r={4} />
        <Block h={11} w={`${46 - shrink * 7}%`} r={4} />
      </div>
    </div>
  );
}

export function ScreenSkeleton({ groups = 2, rows = 3 }: { groups?: number; rows?: number }) {
  return (
    <main className="ios-scroll ios-skeleton" aria-busy="true" aria-label="Loading">
      <div style={{ padding: "20px var(--ios-gutter)" }}>
        {/* Title block */}
        <Block h={13} w="32%" r={4} />
        <div style={{ height: 10 }} />
        <Block h={30} w="54%" />

        {Array.from({ length: groups }).map((_, g) => (
          <div key={g} style={{ marginTop: 26 }}>
            <Block h={11} w="26%" r={4} />
            <div
              style={{
                marginTop: 10,
                background: "var(--ios-cell)",
                border: "1px solid var(--ios-separator)",
                borderRadius: 13,
                padding: "2px 14px",
              }}
            >
              {Array.from({ length: rows }).map((_, i) => (
                <div key={i} style={{ borderTop: i === 0 ? "none" : "1px solid var(--ios-separator)" }}>
                  <Row shrink={i} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

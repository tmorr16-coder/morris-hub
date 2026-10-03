// A deadline for a whole section, not just one request.
//
// Every outbound call on Today already had its own timeout, and the page still
// took 30 seconds to finish on a cold open. Per-request timeouts do not add up
// to a section timeout: the weather tile makes four calls to api.weather.gov in
// a row, each allowed six seconds, and the news section reads several feeds
// with six seconds each. On a cold open nothing is cached, so the whole chain
// runs, and the streamed response stays open until the slowest section is done.
//
// The installed app on iPhone and iPad does not paint until that response
// finishes, so the cost was not "the weather arrives late" — it was a black
// screen for the length of the slowest third-party API in the chain.
//
// withDeadline races the work against a clock and gives up on waiting, not on
// the work: the fetch carries on and fills Next's fetch cache, so the next open
// has the answer instantly. A missing forecast or headline is a much smaller
// failure than a page that will not open.

export function withDeadline<T>(work: Promise<T>, ms: number, fallback: T, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const started = Date.now();
  const late = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      // Kept on purpose: a section that keeps missing is worth knowing about.
      console.log(JSON.stringify({ perf: "deadline-missed", section: label, ms }));
      resolve(fallback);
    }, ms);
  });
  const settled = work.then(
    (v) => {
      const took = Date.now() - started;
      if (took > ms / 2) console.log(JSON.stringify({ perf: "section-slow", section: label, ms: took }));
      return v;
    },
    () => fallback,
  );
  return Promise.race([settled, late]).finally(() => clearTimeout(timer));
}

/** How long Today waits on any one streamed section. */
export const TODAY_SECTION_MS = 2500;

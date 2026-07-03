interface BodyCompChartProps {
  weight: number[];
  muscle: number[];
  fat: number[];
  labels: string[];
}

// iOS semantic hues for the three overlaid series.
const C_WEIGHT = "var(--ios-label)";
const C_MUSCLE = "var(--ios-green)";
const C_FAT    = "var(--ios-tint)";

export default function BodyCompChart({ weight, muscle, fat, labels }: BodyCompChartProps) {
  const height = 160;
  const width = 100;

  const norm = (data: number[]) => {
    const max = Math.max(...data);
    const min = Math.min(...data);
    return data.map((v) => height - ((v - min) / (max - min + 0.01)) * (height - 30) - 15);
  };

  const wY = norm(weight);
  const mY = norm(muscle);
  const fY = norm(fat);
  const xStep = width / (weight.length - 1);

  const toPath = (yArr: number[]) =>
    yArr.map((y, i) => `${i * xStep},${y}`).join(" ");

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: 160 }}
      >
        <polyline
          points={toPath(wY)}
          fill="none"
          style={{ stroke: C_WEIGHT }}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points={toPath(mY)}
          fill="none"
          style={{ stroke: C_MUSCLE }}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="2,2"
        />
        <polyline
          points={toPath(fY)}
          fill="none"
          style={{ stroke: C_FAT }}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="3,2"
        />
        {wY.map((y, i) => (
          <circle key={`w${i}`} cx={i * xStep} cy={y} r="1.5" style={{ fill: C_WEIGHT }} />
        ))}
        {mY.map((y, i) => (
          <circle key={`m${i}`} cx={i * xStep} cy={y} r="1.5" style={{ fill: C_MUSCLE }} />
        ))}
      </svg>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 6,
          padding: "0 4px",
        }}
      >
        {labels.map((l, i) => (
          <span key={i} className="ios-caption ios-num" style={{ color: "var(--ios-label-3)" }}>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

interface BodyCompChartProps {
  weight: number[];
  muscle: number[];
  fat: number[];
  labels: string[];
}

// Token hex values used directly in SVG attributes (CSS vars don't work there)
const C_SLATE = "#2f3a47";
const C_MOSS  = "#4a6a4d";
const C_ACCENT = "#b84a2e";

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
          stroke={C_SLATE}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <polyline
          points={toPath(mY)}
          fill="none"
          stroke={C_MOSS}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="2,2"
        />
        <polyline
          points={toPath(fY)}
          fill="none"
          stroke={C_ACCENT}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="3,2"
        />
        {wY.map((y, i) => (
          <circle key={`w${i}`} cx={i * xStep} cy={y} r="1.5" fill={C_SLATE} />
        ))}
        {mY.map((y, i) => (
          <circle key={`m${i}`} cx={i * xStep} cy={y} r="1.5" fill={C_MOSS} />
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
          <span key={i} style={{ fontSize: 10, color: "var(--color-ink-4)" }}>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

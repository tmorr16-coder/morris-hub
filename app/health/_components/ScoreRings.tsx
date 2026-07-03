import { RadialGauge } from "@/components/ios";

interface Score {
  label: string;
  value: number;
  color: string;
}

export default function ScoreRings({ scores }: { scores: Score[] }) {
  return (
    <div className="ios-list" style={{ padding: "18px 8px", display: "flex", justifyContent: "space-around" }}>
      {scores.map((s) => (
        <RadialGauge
          key={s.label}
          value={s.value / 100}
          color={s.color}
          label={s.label}
          center={<span className="ios-num" style={{ fontSize: 20, fontWeight: 700 }}>{s.value}</span>}
        />
      ))}
    </div>
  );
}

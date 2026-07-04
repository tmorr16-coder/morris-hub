export default function Loading() {
  return (
    <div className="ios-scroll" style={{ padding: "24px 16px" }}>
      <div
        style={{
          height: 34,
          width: "55%",
          borderRadius: 8,
          background: "var(--ios-fill)",
          marginBottom: 20,
        }}
      />
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 15,
            width: `${92 - (i % 4) * 9}%`,
            borderRadius: 6,
            background: "var(--ios-fill)",
            margin: "12px 0",
            opacity: 1 - i * 0.06,
          }}
        />
      ))}
    </div>
  );
}

import { getRandomTips } from "@/lib/tips";
import ClaudeTipClient from "./ClaudeTipClient";

// Revalidate once per day (86400 seconds) to show fresh tips daily
export const revalidate = 86400;

export default async function ClaudeTipCard() {
  // Fetch all tips so the client can cycle through them without another fetch.
  // Fresh tips are fetched daily due to revalidate setting above.
  const tips = await getRandomTips(50);

  return (
    <div style={card}>
      <ClaudeTipClient tips={tips} />
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--color-bg-card)",
  border: "1px solid var(--color-rule)",
  borderRadius: 12,
  padding: "20px 24px",
  boxShadow: "var(--shadow-card)",
  height: "100%",
  boxSizing: "border-box",
};

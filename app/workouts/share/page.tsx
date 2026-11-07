import type { Metadata } from "next";
import Link from "next/link";
import WorkoutShareCard from "@/components/WorkoutShareCard";
import { parseWorkoutShare, workoutShareDescription } from "@/lib/workout-sharing";

type Props = { searchParams: Promise<{ s?: string }> };
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { s } = await searchParams;
  const summary = parseWorkoutShare(s);
  if (!summary) return { title: "Workout summary unavailable", robots: { index: false, follow: false } };
  const image = new URL("/workouts/share/image", "https://morrisai.family");
  image.searchParams.set("s", JSON.stringify(summary));
  return {
    title: `${summary.title} · Morris AI Family`, description: workoutShareDescription(summary),
    robots: { index: false, follow: false },
    openGraph: { title: summary.title, description: workoutShareDescription(summary), type: "website", images: [{ url: image.toString(), width: 1200, height: 630, alt: "Shared workout summary" }] },
    twitter: { card: "summary_large_image", images: [image.toString()] },
  };
}
export default async function SharedWorkoutPage({ searchParams }: Props) {
  const summary = parseWorkoutShare((await searchParams).s);
  return <main style={{ maxWidth: 620, margin: "0 auto", padding: "48px 20px", minHeight: "100dvh" }}>
    <p style={{ fontSize: 14, color: "var(--pf-text-2)" }}>Morris AI Family · Shared workout</p>
    {summary ? <WorkoutShareCard summary={summary} /> : <><h1>Workout summary unavailable</h1><p>This summary link is incomplete or invalid.</p></>}
    <p style={{ color: "var(--pf-text-2)", lineHeight: 1.6 }}>A little progress, shared together. Celebrate showing up and encourage someone else to move today.</p>
    <Link href="/" style={{ color: "var(--pf-tint)" }}>Explore Morris AI Family →</Link>
  </main>;
}

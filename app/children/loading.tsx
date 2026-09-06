import { ScreenSkeleton } from "@/components/ios";

// Shown the instant a navigation into /children starts, instead of the browser
// sitting on the previous screen until the server responds. The module layout
// already provides the scope and the tab bar around this.
export default function Loading() {
  return <ScreenSkeleton />;
}

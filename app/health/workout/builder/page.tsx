import BuilderClient from './_components/BuilderClient';
import { getLastWorkout } from '../_lib/last-workout';
import { getCurrentUserId } from '@/lib/health/auth';
import { LargeTitle } from '@/components/ios';

export default async function BuilderPage() {
  const userId = await getCurrentUserId();
  const lastWorkout = await getLastWorkout(userId);

  return (
    <div className="ios-scroll">
      <LargeTitle title="Build a workout" subtitle="Plan your session" />
      <BuilderClient lastWorkout={lastWorkout} />
    </div>
  );
}

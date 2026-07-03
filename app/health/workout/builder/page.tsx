import BuilderClient from './_components/BuilderClient';
import { getLastWorkout } from '../_lib/last-workout';
import { getCurrentUserId } from '@/lib/health/auth';

export default async function BuilderPage() {
  const userId = await getCurrentUserId();
  const lastWorkout = await getLastWorkout(userId);

  return (
    <div className="ios-scroll">
      <BuilderClient lastWorkout={lastWorkout} />
    </div>
  );
}

'use server';

import { revalidatePath } from 'next/cache';
import { getRepository, DEV_USER_ID } from '@/server/repositories';
import { DEV_TZ as TZ } from '@/lib/dev';
import { track } from '@/lib/analytics';

export async function checkRoutineAction(routineId: string): Promise<void> {
  const routine = await getRepository().checkRoutine(DEV_USER_ID, routineId, new Date());
  track('routine_checked', { routineId });
  track('streak_incremented', { routineId, streak: routine.streakCount });
  revalidatePath('/routines');
}

export async function createRoutineAction(title: string): Promise<void> {
  const t = title.trim();
  if (!t) return;
  await getRepository().createRoutine(DEV_USER_ID, t, TZ);
  revalidatePath('/routines');
}

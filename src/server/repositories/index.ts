import type { WorkspaceRepository } from '@/domain/loop/repository';
import { InMemoryWorkspaceRepository } from '@/server/repositories/inMemory';

/**
 * Single swap point for the persistence layer. Today it returns the in-memory
 * repository (dev/test scaffolding). When Supabase is connected, this returns the
 * Prisma implementation of the SAME WorkspaceRepository interface — nothing else changes.
 *
 * Dev identity constants stand in for the authenticated user/space until Step 7 (auth).
 */
export const DEV_SPACE_ID = '00000000-0000-0000-0000-0000000000s1';
export const DEV_USER_ID = '00000000-0000-0000-0000-0000000000u1';

let singleton: WorkspaceRepository | null = null;

export function getRepository(): WorkspaceRepository {
  if (!singleton) {
    singleton = new InMemoryWorkspaceRepository(DEV_SPACE_ID, DEV_USER_ID);
  }
  return singleton;
}

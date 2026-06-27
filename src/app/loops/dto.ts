import type { Priority, Channel } from '@/domain/enums';

/** Serializable input for creating a confirmed loop via the server action. */
export interface CreateLoopInput {
  owners: Array<{ contactId: string; name: string }>;
  title: string;
  ask: string;
  definitionOfDone: string;
  deadlineIso: string | null;
  priority: Priority;
  channel: Channel | null;
}

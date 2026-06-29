import { OnboardingClient } from '@/components/onboarding/OnboardingClient';
import { getRepository, DEV_SPACE_ID } from '@/server/repositories';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const contacts = await getRepository().listContacts(DEV_SPACE_ID);
  return <OnboardingClient contacts={contacts} />;
}

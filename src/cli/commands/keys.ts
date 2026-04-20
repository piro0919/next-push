import { generateVAPIDKeys } from "../../server/vapid/keys";

export async function generateKeysOutput(subject?: string): Promise<string[]> {
  const { publicKey, privateKey } = await generateVAPIDKeys();
  return [
    `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`,
    `VAPID_PRIVATE_KEY=${privateKey}`,
    `VAPID_SUBJECT=${subject ?? "mailto:you@example.com"}`,
  ];
}

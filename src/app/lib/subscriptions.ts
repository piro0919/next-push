import type { PushSubscriptionJSON } from "../../core/types";

const store = new Map<string, PushSubscriptionJSON>();

export function add(sub: PushSubscriptionJSON): void {
  store.set(sub.endpoint, sub);
}
export function remove(endpoint: string): void {
  store.delete(endpoint);
}
export function all(): PushSubscriptionJSON[] {
  return [...store.values()];
}

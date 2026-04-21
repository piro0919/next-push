import type { PushPayload, PushSubscriptionJSON, SendOptions, SendResult } from "../core/types";
import { type SendPushConfig, sendPush } from "./sendPush";

export interface BatchSendOptions extends SendOptions, SendPushConfig {
  /** Maximum concurrent requests; default 10. */
  concurrency?: number;
  /** Called once per completed subscription with (done, total). */
  onProgress?: (done: number, total: number) => void;
}

export interface BatchSendResult {
  total: number;
  sent: number;
  gone: number;
  failed: number;
  results: Array<{ subscription: PushSubscriptionJSON; result: SendResult }>;
  /** Endpoints of subscriptions that returned gone:true — delete these from storage. */
  goneEndpoints: string[];
}

export async function sendPushBatch<T extends PushPayload = PushPayload>(
  subscriptions: PushSubscriptionJSON[],
  payload: T,
  options: BatchSendOptions = {},
): Promise<BatchSendResult> {
  const { concurrency = 10, onProgress, ...sendOptions } = options;
  const total = subscriptions.length;
  const results: BatchSendResult["results"] = new Array(total);
  let sent = 0;
  let gone = 0;
  let failed = 0;
  let done = 0;

  if (total === 0) {
    return { total: 0, sent: 0, gone: 0, failed: 0, results: [], goneEndpoints: [] };
  }

  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (true) {
      const i = nextIndex++;
      if (i >= total) return;
      const sub = subscriptions[i];
      const result = await sendPush(sub, payload, sendOptions);
      results[i] = { subscription: sub, result };
      if (result.ok) sent++;
      else if (result.gone) gone++;
      else failed++;
      done++;
      onProgress?.(done, total);
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
  await Promise.all(workers);

  const goneEndpoints = results
    .filter((r) => !r.result.ok && r.result.gone)
    .map((r) => r.subscription.endpoint);

  return { total, sent, gone, failed, results, goneEndpoints };
}

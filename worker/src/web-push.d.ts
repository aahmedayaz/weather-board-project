// web-push 4.x ships no type definitions. Only the surface this worker uses is declared.
declare module 'web-push' {
  export interface PushSubscription {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }

  export interface RequestOptions {
    vapidDetails: { subject: string; publicKey: string; privateKey: string };
    /** Seconds the push service should keep trying to deliver. */
    TTL?: number;
    urgency?: 'very-low' | 'low' | 'normal' | 'high';
    /** Replaces an undelivered message with the same topic (≤ 32 base64url chars). */
    topic?: string;
  }

  export interface SendResult {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  }

  /** Rejects with a WebPushError (has `statusCode`) on any non-2xx response. */
  export function sendNotification(
    subscription: PushSubscription,
    payload: string,
    options: RequestOptions,
  ): Promise<SendResult>;
}

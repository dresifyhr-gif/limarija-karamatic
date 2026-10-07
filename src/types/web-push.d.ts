/** Minimalni tipovi za web-push 3.6 (paket nema vlastite tipove). Koristi se samo na serveru (src/lib/server/push.ts). */
declare module 'web-push' {
  export interface PushSubscription {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }
  export interface RequestOptions {
    TTL?: number;
    urgency?: 'very-low' | 'low' | 'normal' | 'high';
    topic?: string;
    timeout?: number;
    headers?: Record<string, string>;
    vapidDetails?: { subject: string; publicKey: string; privateKey: string };
    contentEncoding?: 'aes128gcm' | 'aesgcm';
  }
  export interface SendResult {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  }
  export class WebPushError extends Error {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
    endpoint: string;
  }
  export function sendNotification(subscription: PushSubscription, payload?: string | Buffer | null, options?: RequestOptions): Promise<SendResult>;
  export function generateVAPIDKeys(): { publicKey: string; privateKey: string };
  const webpush: {
    sendNotification: typeof sendNotification;
    generateVAPIDKeys: typeof generateVAPIDKeys;
    WebPushError: typeof WebPushError;
  };
  export default webpush;
}

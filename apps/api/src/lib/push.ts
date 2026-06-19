import webpush from 'web-push';
import { prisma } from './prisma';
import { logger } from './logger';

// Web Push (browser notifications) for the support module. VAPID keys come from
// env (generate with `npx web-push generate-vapid-keys`). If unset, push is a
// no-op — in-app socket notifications + email still work.

const PUB = process.env.VAPID_PUBLIC_KEY;
const PRIV = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@example.com';

let configured = false;
if (PUB && PRIV) {
  try {
    webpush.setVapidDetails(SUBJECT, PUB, PRIV);
    configured = true;
  } catch (e: any) {
    logger.warn({ err: e?.message }, '[push] invalid VAPID config — web push disabled');
  }
}

export function pushAvailable(): boolean {
  return configured;
}

export function vapidPublicKey(): string | null {
  return PUB ?? null;
}

export interface PushPayload {
  title: string;
  body: string;
  ticketId: string;
  url?: string;
  tag?: string;
}

/**
 * Send a web-push to every browser endpoint registered for a user. Prunes
 * subscriptions that the push service reports as gone (404/410). Best-effort.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!configured) return;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  await Promise.all(
    subs.map(async (s) => {
      const body = JSON.stringify({
        ...payload,
        url: s.urlTemplate ? s.urlTemplate.replace('{id}', payload.ticketId) : payload.url,
      });
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
      } catch (e: any) {
        const code = e?.statusCode;
        if (code === 404 || code === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        } else {
          logger.warn({ err: e?.message, code }, '[push] send failed');
        }
      }
    }),
  );
}

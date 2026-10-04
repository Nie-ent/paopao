/**
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set.
 * Fails closed: if CRON_SECRET is missing, every request is rejected.
 */
export function isAuthorizedCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not set; rejecting cron request.");
    return false;
  }
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

// ─── Unified notification sender ─────────────────────────
// Поддерживает Telegram Bot API и email (webhook).
// Конфиг через env vars (см. .env.local.example).

export async function sendNotification(
  message: string,
  opts: { silent?: boolean } = {}
): Promise<void> {
  const promises: Promise<void>[] = [];

  // ── Telegram ────────────────────────────────────────────
  const tgToken  = process.env.TELEGRAM_BOT_TOKEN;
  const tgChatId = process.env.TELEGRAM_CHAT_ID;

  if (tgToken && tgChatId) {
    promises.push(sendTelegram(tgToken, tgChatId, message, opts.silent));
  }

  // ── Generic webhook (email / Slack / Teams) ─────────────
  const webhookUrl = process.env.NOTIFICATION_WEBHOOK_URL;
  if (webhookUrl) {
    promises.push(sendWebhook(webhookUrl, message));
  }

  // Не бросаем ошибки — уведомления не критичны
  await Promise.allSettled(promises);
}

// ── Telegram Bot API ────────────────────────────────────
async function sendTelegram(
  token: string,
  chatId: string,
  text: string,
  silent = false
): Promise<void> {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id:              chatId,
      text:                 text.slice(0, 4096), // Telegram limit
      parse_mode:           "HTML",
      disable_notification: silent,
    }),
  });
  if (!res.ok) {
    console.error("[notifications] Telegram error:", await res.text());
  }
}

// ── Generic JSON webhook ────────────────────────────────
async function sendWebhook(url: string, message: string): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text:      message,
      timestamp: new Date().toISOString(),
      source:    "CLM MBank",
    }),
  });
  if (!res.ok) {
    console.error("[notifications] Webhook error:", await res.text());
  }
}

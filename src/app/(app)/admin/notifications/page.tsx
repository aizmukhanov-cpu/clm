import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NotificationsForm } from "./NotificationsForm";

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/dashboard");

  const config = {
    telegramConfigured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    webhookConfigured:  !!process.env.NOTIFICATION_WEBHOOK_URL,
    telegramChatId:     process.env.TELEGRAM_CHAT_ID ?? "",
    webhookUrl:         process.env.NOTIFICATION_WEBHOOK_URL ?? "",
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Уведомления</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Telegram-бот и webhook для оповещений по задачам и эскалациям
        </p>
      </div>
      <NotificationsForm config={config} />
    </div>
  );
}

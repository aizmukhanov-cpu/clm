"use client";

import { useState } from "react";
import { escalateOverdueTasks } from "@/lib/actions/tasks";
import { triggerRFMSync, triggerEventTriggers, triggerHunterHandoff } from "@/lib/actions/admin-triggers";

type Config = {
  telegramConfigured: boolean;
  webhookConfigured:  boolean;
  telegramChatId:     string;
  webhookUrl:         string;
};

type TriggerState = "idle" | "loading" | "done" | "error";

function TriggerButton({
  label,
  description,
  onRun,
  result,
  state,
}: {
  label:       string;
  description: string;
  onRun:       () => void;
  result:      string | null;
  state:       TriggerState;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        {result && (
          <p className={`text-xs mt-1 font-medium ${state === "error" ? "text-red-600" : "text-emerald-700"}`}>
            {result}
          </p>
        )}
      </div>
      <button
        onClick={onRun}
        disabled={state === "loading"}
        className="shrink-0 h-8 px-3 rounded-lg text-xs font-medium text-white disabled:opacity-60 transition-opacity hover:opacity-90"
        style={{ background: "var(--mbank-green)" }}
      >
        {state === "loading" ? "Запуск…" : "Запустить"}
      </button>
    </div>
  );
}

export function NotificationsForm({ config }: { config: Config }) {
  // Escalation
  const [escState, setEscState] = useState<TriggerState>("idle");
  const [escResult, setEscResult] = useState<string | null>(null);

  // RFM sync
  const [rfmState, setRfmState] = useState<TriggerState>("idle");
  const [rfmResult, setRfmResult] = useState<string | null>(null);

  // Event triggers
  const [evtState, setEvtState] = useState<TriggerState>("idle");
  const [evtResult, setEvtResult] = useState<string | null>(null);

  // Hunter handoff
  const [handoffState, setHandoffState] = useState<TriggerState>("idle");
  const [handoffResult, setHandoffResult] = useState<string | null>(null);

  async function handleEscalate() {
    setEscState("loading"); setEscResult(null);
    const res = await escalateOverdueTasks();
    if (res.error) { setEscResult(`❌ ${res.error}`); setEscState("error"); }
    else { setEscResult(`✅ Эскалировано задач: ${res.escalated}`); setEscState("done"); }
  }

  async function handleRFMSync() {
    setRfmState("loading"); setRfmResult(null);
    const res = await triggerRFMSync();
    if ("error" in res && res.error) { setRfmResult(`❌ ${res.error}`); setRfmState("error"); }
    else { setRfmResult(`✅ Обновлено клиентов: ${res.updated}, переходов: ${res.stageShifts}`); setRfmState("done"); }
  }

  async function handleEventTriggers() {
    setEvtState("loading"); setEvtResult(null);
    const res = await triggerEventTriggers();
    if ("error" in res && res.error) { setEvtResult(`❌ ${res.error}`); setEvtState("error"); }
    else { setEvtResult(`✅ Задач создано: ${res.tasksCreated}`); setEvtState("done"); }
  }

  async function handleHunterHandoff() {
    setHandoffState("loading"); setHandoffResult(null);
    const res = await triggerHunterHandoff();
    if ("error" in res && res.error) { setHandoffResult(`❌ ${res.error}`); setHandoffState("error"); }
    else {
      const msg = res.transferred > 0
        ? `✅ Передано: ${res.transferred}${res.skipped > 0 ? `, пропущено (нет фермера): ${res.skipped}` : ""}`
        : res.skipped > 0
          ? `⚠️ Нет клиентов для передачи (или нет фермеров): пропущено ${res.skipped}`
          : "✅ Нет клиентов, ожидающих передачи";
      setHandoffResult(msg);
      setHandoffState("done");
    }
  }

  return (
    <div className="space-y-4">
      {/* Status cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 text-sm">Telegram Bot</h3>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              config.telegramConfigured
                ? "bg-emerald-50 text-emerald-700"
                : "bg-gray-100 text-gray-500"
            }`}>
              {config.telegramConfigured ? "Подключён" : "Не настроен"}
            </span>
          </div>
          <div className="space-y-2 text-xs text-gray-500">
            {config.telegramConfigured ? (
              <p>Chat ID: <code className="font-mono bg-gray-50 px-1 rounded">{config.telegramChatId}</code></p>
            ) : (
              <p>Добавьте в <code className="font-mono bg-gray-50 px-1 rounded">.env.local</code>:</p>
            )}
            <pre className="bg-gray-50 rounded-lg p-3 text-[11px] leading-relaxed text-gray-600 overflow-x-auto">{
`TELEGRAM_BOT_TOKEN=1234567890:AAH...
TELEGRAM_CHAT_ID=-1001234567890`
            }</pre>
            <p className="text-gray-400">Создайте бота через @BotFather → получите token → добавьте бота в группу/канал → получите chat_id.</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 text-sm">Webhook (Slack / Teams / Email)</h3>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              config.webhookConfigured
                ? "bg-emerald-50 text-emerald-700"
                : "bg-gray-100 text-gray-500"
            }`}>
              {config.webhookConfigured ? "Подключён" : "Не настроен"}
            </span>
          </div>
          <div className="space-y-2 text-xs text-gray-500">
            {config.webhookConfigured ? (
              <p>URL: <code className="font-mono bg-gray-50 px-1 rounded text-[10px] break-all">{config.webhookUrl.slice(0, 60)}…</code></p>
            ) : (
              <p>Добавьте в <code className="font-mono bg-gray-50 px-1 rounded">.env.local</code>:</p>
            )}
            <pre className="bg-gray-50 rounded-lg p-3 text-[11px] leading-relaxed text-gray-600">{
`NOTIFICATION_WEBHOOK_URL=https://hooks.slack.com/...
# или любой POST-endpoint принимающий JSON`
            }</pre>
          </div>
        </div>
      </div>

      {/* Manual triggers */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 text-sm mb-1">Ручной запуск автоматизации</h3>
        <p className="text-xs text-gray-400 mb-5">
          В проде все три процесса запускаются ночным cron-заданием. Здесь — ручной запуск для тестирования.
        </p>

        <div className="space-y-5 divide-y divide-gray-100">
          <div className="pt-0">
            <TriggerButton
              label="Эскалация задач (D+7)"
              description="Переводит все PENDING/OVERDUE задачи без результата старше 7 дней в статус ESCALATED и отправляет уведомление."
              onRun={handleEscalate}
              result={escResult}
              state={escState}
            />
          </div>
          <div className="pt-4">
            <TriggerButton
              label="RFM-D Sync — когорты и стадии"
              description="Пересчитывает clmCohort и clmStage для всех активных клиентов по транзакционным сигналам."
              onRun={handleRFMSync}
              result={rfmResult}
              state={rfmState}
            />
          </div>
          <div className="pt-4">
            <TriggerButton
              label="Event Triggers — автозадачи"
              description="Проверяет все условия триггеров (реактивация 30/60д, кросс-продажи, KAM review) и создаёт задачи менеджерам."
              onRun={handleEventTriggers}
              result={evtResult}
              state={evtState}
            />
          </div>
          <div className="pt-4">
            <TriggerButton
              label="Hunter Handoff — передача фермерам"
              description="Передаёт клиентов, активных 60+ дней, от охотников (B2B/KM) к фермерам: SMALL → BRANCH, MEDIUM → VB, LARGE → KAM."
              onRun={handleHunterHandoff}
              result={handoffResult}
              state={handoffState}
            />
          </div>
        </div>
      </div>

      {/* Cron endpoint info */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-800 space-y-1">
        <p className="font-semibold">Автоматизация через cron (ночной запуск)</p>
        <p>Настройте ежедневный вызов всех трёх endpoint'ов с заголовком <code className="font-mono bg-amber-100 px-1 rounded">Authorization: Bearer $CRON_SECRET</code>:</p>
        <pre className="bg-amber-100 rounded p-2 text-[11px] font-mono mt-1 overflow-x-auto">{
`POST /api/cron/rfm-sync          — 03:00 ежедневно (когорты, стадии, sizeCategory)
POST /api/cron/event-triggers    — 03:05 ежедневно (автозадачи)
POST /api/cron/handoff           — 03:10 ежедневно (передача B2B/KM → BRANCH/VB/KAM)
POST /api/cron/escalate          — 08:00 ежедневно (просроченные задачи)
POST /api/cron/reminders         — 09:00 ежедневно (напоминания на завтра)`
        }</pre>
        <p className="text-amber-700/60">Через Vercel Cron Jobs, GitHub Actions Schedule или внешний планировщик.</p>
      </div>
    </div>
  );
}

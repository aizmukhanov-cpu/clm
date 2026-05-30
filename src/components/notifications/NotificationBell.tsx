"use client";

import { useState, useEffect, useRef, useCallback, CSSProperties } from "react";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { useRouter } from "next/navigation";

type NotifItem = {
  id:        string;
  type:      string;
  title:     string;
  body:      string;
  href:      string;
  readAt:    string | null;
  createdAt: string;
};

const TYPE_ICON: Record<string, string> = {
  task_assigned:   "📋",
  task_overdue:    "⚠️",
  task_escalated:  "🚨",
  task_completed:  "✅",
  client_assigned: "👤",
};

const TYPE_COLOR: Record<string, string> = {
  task_assigned:   "#3b82f6",
  task_overdue:    "#f59e0b",
  task_escalated:  "#ef4444",
  task_completed:  "#10b981",
  client_assigned: "#8b5cf6",
};

export function NotificationBell() {
  const [open,       setOpen]      = useState(false);
  const [items,      setItems]     = useState<NotifItem[]>([]);
  const [unread,     setUnread]    = useState(0);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const panelRef  = useRef<HTMLDivElement>(null);
  const bellRef   = useRef<HTMLButtonElement>(null);
  const router    = useRouter();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items ?? []);
      setUnread(data.unread ?? 0);
    } catch {
      // молчим — уведомления не критичны
    }
  }, []);

  // Первичная загрузка + поллинг каждые 60 секунд
  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  // Закрытие по клику вне панели
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  async function handleItemClick(item: NotifItem) {
    if (!item.readAt) {
      // Оптимистичный UI
      setItems((prev) =>
        prev.map((n) => n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)
      );
      setUnread((prev) => Math.max(0, prev - 1));
      fetch("/api/notifications/read", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id: item.id }),
      }).catch(() => {});
    }
    setOpen(false);
    if (item.href) router.push(item.href);
  }

  async function handleMarkAll() {
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnread(0);
    fetch("/api/notifications/read", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ all: true }),
    }).catch(() => {});
  }

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={bellRef}
        onClick={() => {
          if (open) { setOpen(false); return; }
          // Вычисляем позицию панели относительно вьюпорта (fixed)
          const rect = bellRef.current?.getBoundingClientRect();
          if (rect) {
            const PANEL_W = 320;
            const PANEL_MAX_H = 420;
            const GAP = 8;
            // По горизонтали: выравниваем по левому краю кнопки, но не выходим за экран
            let left = rect.left;
            if (left + PANEL_W > window.innerWidth - 8) {
              left = window.innerWidth - PANEL_W - 8;
            }
            // По вертикали: открываем вверх если места внизу недостаточно
            const spaceBelow = window.innerHeight - rect.bottom - GAP;
            const spaceAbove = rect.top - GAP;
            if (spaceBelow >= Math.min(PANEL_MAX_H, 200) || spaceBelow >= spaceAbove) {
              // Открываем вниз
              setPanelStyle({ top: rect.bottom + GAP, left, position: "fixed" });
            } else {
              // Открываем вверх
              setPanelStyle({ bottom: window.innerHeight - rect.top + GAP, left, position: "fixed" });
            }
          }
          load();
          setOpen(true);
        }}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
        style={{ color: "#6b7280" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "#f3f4f6"; e.currentTarget.style.color = "#111827"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#6b7280"; }}
        title="Уведомления"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-0.5 leading-none"
            style={{ background: "#ef4444" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel — fixed позиция вычисляется в onClick */}
      {open && (
        <div
          ref={panelRef}
          className="w-80 bg-white rounded-xl shadow-2xl overflow-hidden z-[200]"
          style={{ ...panelStyle, border: "1px solid rgba(0,0,0,0.08)", maxHeight: "min(420px, calc(100vh - 80px))" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid #f3f4f6" }}>
            <span className="text-sm font-semibold text-gray-900">Уведомления</span>
            {unread > 0 && (
              <button
                onClick={handleMarkAll}
                className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
              >
                Прочитать все
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="text-2xl mb-2">🔔</div>
                <div className="text-sm text-gray-400">Нет уведомлений</div>
              </div>
            ) : (
              items.map((item) => {
                const isUnread = !item.readAt;
                const icon  = TYPE_ICON[item.type]  ?? "🔔";
                const color = TYPE_COLOR[item.type] ?? "#6b7280";
                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className="w-full text-left px-4 py-3 transition-colors"
                    style={{
                      borderBottom:    "1px solid #f9fafb",
                      background:      isUnread ? "rgba(59,130,246,0.04)" : "transparent",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = isUnread ? "rgba(59,130,246,0.04)" : "transparent")}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Icon dot */}
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm mt-0.5"
                        style={{ background: color + "18" }}
                      >
                        {icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs leading-snug ${isUnread ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>
                          {item.title}
                        </div>
                        {item.body && (
                          <div className="text-[11px] text-gray-500 mt-0.5 truncate">{item.body}</div>
                        )}
                        <div className="text-[10px] text-gray-400 mt-1">
                          {formatDistanceToNow(new Date(item.createdAt), { locale: ru, addSuffix: true })}
                        </div>
                      </div>

                      {/* Unread indicator */}
                      {isUnread && (
                        <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: "#3b82f6" }} />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div
              className="px-4 py-2.5 text-center"
              style={{ borderTop: "1px solid #f3f4f6" }}
            >
              <span className="text-[10px] text-gray-400">
                Показаны последние {items.length} уведомлений
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

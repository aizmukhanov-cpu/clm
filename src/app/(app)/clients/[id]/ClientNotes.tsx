"use client";

import { useState, useTransition } from "react";
import { saveClientNotes } from "@/lib/actions/clients";

type Props = {
  clientId: string;
  initialNotes: string | null;
  canEdit: boolean;
};

export function ClientNotes({ clientId, initialNotes, canEdit }: Props) {
  const [editing, setEditing]   = useState(false);
  const [notes,   setNotes]     = useState(initialNotes ?? "");
  const [saved,   setSaved]     = useState(initialNotes ?? "");
  const [pending, startTx]      = useTransition();
  const [msg,     setMsg]       = useState<string | null>(null);

  function handleEdit() { setNotes(saved); setEditing(true); setMsg(null); }
  function handleCancel() { setNotes(saved); setEditing(false); setMsg(null); }

  function handleSave() {
    startTx(async () => {
      const res = await saveClientNotes(clientId, notes.trim());
      if (res.error) { setMsg(`❌ ${res.error}`); }
      else { setSaved(notes.trim()); setEditing(false); setMsg(null); }
    });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">📝 Заметки менеджера</h3>
        {canEdit && !editing && (
          <button
            onClick={handleEdit}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
          >
            {saved ? "Редактировать" : "+ Добавить заметку"}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Свободные заметки по клиенту: договорённости, контекст, инсайты…"
            rows={5}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--mbank-green)] resize-y"
            autoFocus
          />
          {msg && <p className="text-xs text-red-500">{msg}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={pending}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-60 transition-opacity"
              style={{ background: "var(--mbank-green)" }}
            >
              {pending ? "Сохраняю…" : "Сохранить"}
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 rounded-lg text-xs text-gray-500 border border-gray-200 hover:bg-gray-50"
            >
              Отмена
            </button>
          </div>
        </div>
      ) : saved ? (
        <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{saved}</p>
      ) : (
        <p className="text-xs text-gray-300 italic">Заметок нет</p>
      )}
    </div>
  );
}

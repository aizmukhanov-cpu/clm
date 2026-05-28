"use client";

import { useState, useTransition, useActionState } from "react";
import { createContactPerson, updateContactPerson, deleteContactPerson } from "@/lib/actions/contacts";

type ContactPerson = {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  isDecisionMaker: boolean;
  notes: string | null;
};

type Props = {
  clientId: string;
  contacts: ContactPerson[];
  canEdit: boolean;
};

function ContactForm({
  clientId,
  contact,
  onDone,
}: {
  clientId: string;
  contact?: ContactPerson;
  onDone: () => void;
}) {
  const isEdit = !!contact;
  const action = isEdit
    ? updateContactPerson.bind(null, contact.id, clientId)
    : createContactPerson.bind(null, clientId);

  const [error, formAction, pending] = useActionState(action, null);
  const [isDM, setIsDM] = useState(contact?.isDecisionMaker ?? false);

  return (
    <form
      action={async (fd) => {
        fd.set("isDecisionMaker", String(isDM));
        await formAction(fd);
        if (!error) onDone();
      }}
      className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-100"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">
            ФИО <span className="text-red-400">*</span>
          </label>
          <input
            name="name"
            required
            defaultValue={contact?.name ?? ""}
            placeholder="Иванов Иван Иванович"
            className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--mbank-green)]"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Должность</label>
          <input
            name="role"
            defaultValue={contact?.role ?? ""}
            placeholder="Директор, Бухгалтер..."
            className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--mbank-green)]"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Телефон</label>
          <input
            name="phone"
            defaultValue={contact?.phone ?? ""}
            placeholder="+996 700 000 000"
            className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--mbank-green)]"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Email</label>
          <input
            name="email"
            type="email"
            defaultValue={contact?.email ?? ""}
            placeholder="ivan@company.kg"
            className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--mbank-green)]"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-medium text-gray-500 mb-1">Заметки</label>
        <input
          name="notes"
          defaultValue={contact?.notes ?? ""}
          placeholder="Предпочитает WhatsApp, звонить после 11:00..."
          className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--mbank-green)]"
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isDM}
          onChange={(e) => setIsDM(e.target.checked)}
          className="rounded border-gray-300 text-[var(--mbank-green)] focus:ring-[var(--mbank-green)]"
        />
        <span className="text-[11px] text-gray-600">
          Лицо, принимающее решения (ЛПР)
        </span>
      </label>

      {error && (
        <p className="text-[11px] text-red-500 bg-red-50 rounded px-2.5 py-1.5">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold text-white disabled:opacity-60 transition-opacity"
          style={{ background: "var(--mbank-green)" }}
        >
          {pending ? "Сохраняю..." : isEdit ? "Сохранить" : "Добавить контакт"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="px-3 py-1.5 rounded-lg text-[11px] text-gray-500 border border-gray-200 hover:bg-white"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}

export function ContactPersons({ clientId, contacts, canEdit }: Props) {
  const [showForm, setShowForm]       = useState(false);
  const [editId, setEditId]           = useState<string | null>(null);
  const [pending, startTransition]    = useTransition();

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteContactPerson(id, clientId);
    });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">
          Контактные лица
          {contacts.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-400">({contacts.length})</span>
          )}
        </h3>
        {canEdit && !showForm && (
          <button
            onClick={() => { setShowForm(true); setEditId(null); }}
            className="text-xs px-2.5 py-1 rounded-lg border border-dashed font-medium transition-colors hover:bg-gray-50"
            style={{ borderColor: "var(--mbank-green)", color: "var(--mbank-green)" }}
          >
            + Добавить
          </button>
        )}
      </div>

      {showForm && !editId && (
        <div className="mb-4">
          <ContactForm clientId={clientId} onDone={() => setShowForm(false)} />
        </div>
      )}

      {contacts.length === 0 && !showForm ? (
        <p className="text-xs text-gray-400 text-center py-4">
          Контактных лиц пока нет
          {canEdit && (
            <button
              onClick={() => setShowForm(true)}
              className="ml-2 underline"
              style={{ color: "var(--mbank-green)" }}
            >
              добавить
            </button>
          )}
        </p>
      ) : (
        <div className="space-y-3">
          {contacts.map((c) => (
            <div key={c.id}>
              {editId === c.id ? (
                <ContactForm
                  clientId={clientId}
                  contact={c}
                  onDone={() => setEditId(null)}
                />
              ) : (
                <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{
                      background: c.isDecisionMaker ? "var(--mbank-green)" : "#e5e7eb",
                      color: c.isDecisionMaker ? "white" : "#9ca3af",
                    }}
                  >
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800">{c.name}</span>
                      {c.isDecisionMaker && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                          style={{ background: "var(--mbank-green)" }}
                        >
                          ЛПР
                        </span>
                      )}
                      {c.role && (
                        <span className="text-[11px] text-gray-400">{c.role}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {c.phone && (
                        <a
                          href={`tel:${c.phone}`}
                          className="text-[11px] text-blue-600 hover:underline"
                        >
                          📞 {c.phone}
                        </a>
                      )}
                      {c.email && (
                        <a
                          href={`mailto:${c.email}`}
                          className="text-[11px] text-blue-600 hover:underline"
                        >
                          ✉️ {c.email}
                        </a>
                      )}
                    </div>
                    {c.notes && (
                      <p className="text-[11px] text-gray-400 mt-0.5">{c.notes}</p>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { setEditId(c.id); setShowForm(false); }}
                        className="p-1 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-colors text-xs"
                        title="Редактировать"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        disabled={pending}
                        className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors text-xs disabled:opacity-40"
                        title="Удалить"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

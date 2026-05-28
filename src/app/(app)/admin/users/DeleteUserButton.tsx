"use client";

import { useState, useTransition } from "react";
import { deleteUser } from "@/lib/actions/admin-users";

export function DeleteUserButton({
  userId,
  userName,
  clientCount,
}: {
  userId: string;
  userName: string;
  clientCount: number;
}) {
  const [open, setOpen]        = useState(false);
  const [error, setError]      = useState<string | null>(null);
  const [pending, startT]      = useTransition();

  function handleDelete() {
    startT(async () => {
      const res = await deleteUser(userId);
      if (res.error) {
        setError(res.error);
      } else {
        setOpen(false);
      }
    });
  }

  return (
    <>
      <button
        onClick={() => { setError(null); setOpen(true); }}
        className="text-xs px-3 py-1.5 rounded-lg border border-red-100 text-red-400 hover:border-red-300 hover:text-red-600 transition-colors"
      >
        Удалить
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Удалить пользователя?</h3>
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-medium">{userName}</span> будет удалён из системы.
            </p>
            {clientCount > 0 && (
              <p className="text-sm text-orange-600 bg-orange-50 rounded-lg px-3 py-2 mb-1">
                ⚠ У пользователя {clientCount} клиентов. Удаление невозможно — сначала переназначьте клиентов.
              </p>
            )}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-2">{error}</p>
            )}
            <div className="flex gap-3 mt-5">
              <button
                onClick={handleDelete}
                disabled={pending || clientCount > 0}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {pending ? "Удаляю..." : "Удалить"}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2.5 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

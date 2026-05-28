"use client";

import { useState, useTransition } from "react";
import { updatePermission, resetPermissions } from "@/lib/actions/permissions";
import {
  PERMISSION_RESOURCES,
  RESOURCE_LABELS,
  RESOURCE_DESCRIPTIONS,
  CONFIGURABLE_ROLES,
  ROLE_LABELS,
  type PermissionMatrix as Matrix,
  type ConfigurableRole,
  type PermissionResource,
} from "@/lib/permissions-config";

type Props = {
  initialMatrix: Record<ConfigurableRole, Matrix>;
};

export function PermissionMatrix({ initialMatrix }: Props) {
  const [matrix, setMatrix] = useState(initialMatrix);
  const [saving, setSaving] = useState<string | null>(null); // "role:resource"
  const [resetting, setResetting] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleToggle(role: ConfigurableRole, resource: PermissionResource) {
    const newVal = !matrix[role][resource];
    const key = `${role}:${resource}`;
    setSaving(key);

    // Optimistic update
    setMatrix((prev) => ({
      ...prev,
      [role]: { ...prev[role], [resource]: newVal },
    }));

    startTransition(async () => {
      const res = await updatePermission(role, resource, newVal);
      if (res.error) {
        // Rollback on error
        setMatrix((prev) => ({
          ...prev,
          [role]: { ...prev[role], [resource]: !newVal },
        }));
        alert(res.error);
      }
      setSaving(null);
    });
  }

  function handleReset(role: ConfigurableRole) {
    setResetting(role);
    startTransition(async () => {
      await resetPermissions(role);
      setResetting(null);
    });
  }

  return (
    <div className="space-y-5">
      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
        <span className="text-amber-700 font-medium">ℹ️</span>
        <span className="text-amber-700">
          Изменения применяются мгновенно. Пользователи при следующем запросе увидят обновлённые данные.
        </span>
      </div>

      {/* Matrix table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
              <th className="text-left text-xs font-medium text-gray-400 px-5 py-4 w-72">
                Раздел данных
              </th>
              {/* ADMIN — always full, shown for context */}
              <th className="text-center px-4 py-4 w-32">
                <div className="flex flex-col items-center gap-1">
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: "var(--mbank-green-pale)", color: "var(--mbank-green)" }}
                  >
                    Admin
                  </span>
                  <span className="text-[10px] text-gray-400">всегда полный</span>
                </div>
              </th>
              {CONFIGURABLE_ROLES.map((role) => (
                <th key={role} className="text-center px-4 py-4 w-32">
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-xs font-semibold text-gray-700">
                      {ROLE_LABELS[role]}
                    </span>
                    <button
                      onClick={() => handleReset(role)}
                      disabled={resetting === role}
                      className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                    >
                      {resetting === role ? "сбрасываю..." : "сбросить →"}
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_RESOURCES.map((resource, idx) => (
              <tr
                key={resource}
                className={`${idx < PERMISSION_RESOURCES.length - 1 ? "border-b border-gray-50" : ""} hover:bg-gray-50/40 transition-colors`}
              >
                {/* Resource info */}
                <td className="px-5 py-4">
                  <div className="font-medium text-sm text-gray-800">
                    {RESOURCE_LABELS[resource]}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {RESOURCE_DESCRIPTIONS[resource]}
                  </div>
                </td>

                {/* ADMIN — always checked, disabled */}
                <td className="px-4 py-4 text-center">
                  <Toggle checked={true} disabled={true} onChange={() => {}} />
                </td>

                {/* Configurable roles */}
                {CONFIGURABLE_ROLES.map((role) => {
                  const key = `${role}:${resource}`;
                  const checked = matrix[role][resource];
                  const isSaving = saving === key;
                  return (
                    <td key={role} className="px-4 py-4 text-center">
                      <Toggle
                        checked={checked}
                        disabled={isSaving}
                        onChange={() => handleToggle(role, resource)}
                        saving={isSaving}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-3 gap-4">
        {CONFIGURABLE_ROLES.map((role) => {
          const allowed = PERMISSION_RESOURCES.filter((r) => matrix[role][r]).length;
          const total   = PERMISSION_RESOURCES.length;
          const pct     = Math.round((allowed / total) * 100);
          return (
            <div key={role} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">{ROLE_LABELS[role]}</span>
                <span className="text-xs text-gray-400">{allowed}/{total} разделов</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${pct}%`,
                    background: pct === 100
                      ? "var(--mbank-green)"
                      : pct > 50
                      ? "var(--mbank-gold)"
                      : "#f87171",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Toggle component ─────────────────────────────────────── */
function Toggle({
  checked,
  disabled,
  onChange,
  saving = false,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
  saving?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`
        relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent
        transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
        disabled:cursor-not-allowed disabled:opacity-60
        ${checked ? "focus:ring-emerald-500" : "focus:ring-gray-300"}
      `}
      style={{
        background: saving
          ? "#d1d5db"
          : checked
          ? "var(--mbank-green)"
          : "#e5e7eb",
      }}
    >
      <span
        className={`
          pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm
          transition-transform duration-200
          ${checked ? "translate-x-4" : "translate-x-0"}
        `}
      />
    </button>
  );
}

"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, null);

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel — MBank brand ─────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[42%] flex-col justify-between p-10 relative overflow-hidden"
        style={{ background: "var(--mbank-green-dark)" }}
      >
        {/* Decorative circles */}
        <div
          className="absolute -top-24 -right-24 w-80 h-80 rounded-full opacity-10"
          style={{ background: "var(--mbank-green-mid)" }}
        />
        <div
          className="absolute -bottom-32 -left-16 w-96 h-96 rounded-full opacity-10"
          style={{ background: "var(--mbank-green)" }}
        />
        <div
          className="absolute top-1/2 right-8 w-40 h-40 rounded-full opacity-5"
          style={{ background: "var(--mbank-gold)" }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-lg"
            style={{ background: "var(--mbank-gold)" }}
          >
            M
          </div>
          <div>
            <div className="text-white font-semibold tracking-wide">MBank</div>
            <div className="text-white/40 text-xs tracking-widest uppercase">Kyrgyzstan</div>
          </div>
        </div>

        {/* Center copy */}
        <div className="relative z-10 space-y-4">
          <div
            className="text-xs font-semibold tracking-widest uppercase px-3 py-1.5 rounded-full inline-block"
            style={{
              background: "rgba(198,144,58,0.18)",
              color: "var(--mbank-gold-light)",
              border: "1px solid rgba(198,144,58,0.25)",
            }}
          >
            Corporate Segment
          </div>
          <h1 className="text-3xl font-bold text-white leading-tight">
            Управление<br />
            <span style={{ color: "var(--mbank-gold)" }}>клиентским</span><br />
            портфелем
          </h1>
          <p className="text-white/50 text-sm leading-relaxed max-w-xs">
            CLM-система для команд B2B, КМ, Virtual Branch и KAM — единый реестр, pipeline и активация.
          </p>
        </div>

        {/* Bottom stats */}
        <div className="relative z-10 grid grid-cols-3 gap-4">
          {[
            { val: "200+", label: "Клиентов" },
            { val: "4",    label: "Команды" },
            { val: "5",    label: "Стадий CLM" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-xl font-bold" style={{ color: "var(--mbank-gold)" }}>{s.val}</div>
              <div className="text-white/40 text-xs mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel — login form ──────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-8">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white"
            style={{ background: "var(--mbank-gold)" }}
          >
            M
          </div>
          <span className="font-semibold text-gray-800">MBank CLM</span>
        </div>

        <div className="w-full max-w-sm">
          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Вход в систему</h2>
            <p className="text-sm text-gray-400 mt-1">Введите корпоративный email и пароль</p>
          </div>

          {/* Form */}
          <form action={action} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="your@mbank.kg"
                autoComplete="email"
                required
                className="h-11 border-gray-200 focus-visible:ring-0 focus-visible:border-[var(--mbank-green)] transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                Пароль
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="h-11 border-gray-200 focus-visible:ring-0 focus-visible:border-[var(--mbank-green)] transition-colors"
              />
            </div>

            {state?.error && (
              <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
                {state.error}
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full h-11 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ background: pending ? "var(--mbank-green-mid)" : "var(--mbank-green)" }}
            >
              {pending ? "Вход..." : "Войти"}
            </button>
          </form>

          {/* Test accounts */}
          <div className="mt-8 rounded-xl p-4 text-xs space-y-1" style={{ background: "var(--mbank-green-pale)" }}>
            <p className="font-semibold mb-2" style={{ color: "var(--mbank-green)" }}>
              Тестовые аккаунты
            </p>
            {[
              ["admin@mbank.kg",   "Адал И. — Админ"],
              ["km@mbank.kg",      "Динара Т. — КМ"],
              ["analyst@mbank.kg", "Айгуль К. — VB"],
              ["kam@mbank.kg",     "Нурлан О. — KAM"],
              ["b2b@mbank.kg",     "Бекзат М. — B2B"],
              ["branch@mbank.kg",  "Гүлзат Р. — Филиал"],
            ].map(([email, label]) => (
              <div key={email} className="flex justify-between text-gray-600">
                <span className="font-mono">{email}</span>
                <span className="text-gray-400">{label}</span>
              </div>
            ))}
            <p className="mt-2 text-gray-500">Пароль: <span className="font-mono font-semibold">password123</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}

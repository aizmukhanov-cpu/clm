# CLM MVP — MBank Corporate CRM

Система управления клиентским циклом (CLM) для корпоративного сегмента MBank Kyrgyzstan.
Охватывает полный жизненный цикл клиента: привлечение → онбординг → активация → рост → реактивация.

---

## Технологический стек

| Слой | Технология |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| ORM | Prisma 7 (`provider = "prisma-client"`, output `src/generated/prisma`) |
| Database | PostgreSQL (Supabase) + PgBouncer (transaction pooler, порт 6543) |
| Auth | Iron Session (jose + bcryptjs) |
| Styling | Tailwind CSS v4 + CSS variables |
| Notifications | Telegram Bot API |
| Cron | Vercel Cron / внешний curl |

> ⚠️ **Next.js 16** — не то, что вы знаете. `searchParams` — Promise, `useActionState` вместо `useFormState`, Turbopack по умолчанию. Перед правками читайте `node_modules/next/dist/docs/`.

---

## Архитектура

```
src/
├── app/
│   ├── (app)/                     # Защищённые страницы
│   │   ├── dashboard/             # Дашборд с трендами (sparklines, WoW-дельты)
│   │   ├── home/                  # Стартовая после логина
│   │   ├── clients/               # Реестр клиентов + карточка + взаимодействия
│   │   ├── my-portfolio/          # Портфель текущего пользователя
│   │   ├── my-tasks/              # Мои задачи
│   │   ├── activation-desk/       # Очередь активации (ONBOARD)
│   │   ├── reactivation/          # Очередь реактивации (REACTIVATE/LAPSED)
│   │   ├── pipeline/              # Сделки B2B / KM (с шаблонами КП)
│   │   ├── kpi/                   # KPI команд и менеджеров + тренды
│   │   ├── kam/                   # Портфели KAM
│   │   ├── branches/              # Филиалы + цели по продуктам
│   │   └── admin/                 # Только ADMIN
│   │       ├── users/             # CRUD сотрудников
│   │       ├── permissions/       # Матрица доступа ролей
│   │       ├── products/          # Каталог продуктов + помесячные планы (по филиалам и командам)
│   │       ├── clm-rules/         # Просмотр правил CLM
│   │       ├── kpi/               # Управление KPI
│   │       └── notifications/     # Telegram + ручной запуск cron
│   ├── api/
│   │   ├── auth/logout/
│   │   ├── clients/export/        # CSV выгрузка
│   │   └── cron/                  # Bearer-защищённые задания
│   │       ├── rfm-sync/          # 03:00 — пересчёт стадий/когорт
│   │       ├── event-triggers/    # 03:05 — событийные задачи
│   │       ├── handoff/           # 03:10 — Hunter→Farmer передача
│   │       ├── escalate/          # 08:00 — эскалация просроченных
│   │       └── reminders/         # 09:00 — Telegram-напоминания
│   └── login/
├── lib/
│   ├── actions/                   # Server Actions
│   │   ├── clients.ts
│   │   ├── activities.ts          # Взаимодействия (звонки/встречи/email + продукт)
│   │   ├── tasks.ts
│   │   ├── dashboard.ts           # Данные дашборда + тренды
│   │   ├── pipeline.ts
│   │   ├── kpi.ts
│   │   ├── portfolio.ts
│   │   ├── kam.ts
│   │   ├── activation-desk.ts
│   │   ├── reactivation.ts
│   │   ├── contacts.ts            # Контактные лица
│   │   ├── accountplan.ts
│   │   ├── proposals.ts
│   │   ├── sequences.ts
│   │   ├── permissions.ts
│   │   ├── snapshots.ts           # Ежедневные снапшоты портфеля (тренды)
│   │   ├── clm-sync.ts
│   │   ├── admin-triggers.ts
│   │   ├── admin-users.ts         # CRUD сотрудников
│   │   └── admin-products.ts      # Каталог продуктов + планы по филиалам/командам
│   ├── clm-rules.ts               # ЕДИНСТВЕННЫЙ источник правил CLM
│   ├── clm-config.ts
│   ├── rfm-sync.ts
│   ├── event-triggers.ts
│   ├── sequences.ts
│   ├── hunter-handoff.ts          # Hunter→Farmer логика
│   ├── health-score.ts
│   ├── churn-risk.ts
│   ├── nba.ts
│   ├── pipeline-config.ts
│   ├── permissions.ts
│   ├── permissions-config.ts
│   ├── product-config.ts          # Константы продуктов и команд (не "use server")
│   ├── task-labels.ts
│   ├── notifications.ts
│   ├── access.ts
│   ├── auth.ts
│   └── db.ts
├── components/
│   ├── layout/                    # Sidebar, Header
│   ├── clients/
│   ├── pipeline/
│   ├── shared/
│   └── ui/
└── generated/prisma/              # Prisma-клиент (gitignored, генерируется)
```

---

## CLM-логика

### Стадии клиента

| Стадия | Смысл | Автопереход |
|---|---|---|
| `ACQUIRE` | Привлечение — счёт ещё не открыт | Только ручной |
| `ONBOARD` | Счёт открыт, активностей нет | `txnCount30d ≥ 1` → `ACTIVATE` |
| `ACTIVATE` | Есть транзакции | `txnCount30d ≥ 5` + `gmv30d ≥ 500k` → `GROW`; `daysSinceLastTxn ≥ 60` → `REACTIVATE` |
| `GROW` | Стабильно активный | `daysSinceLastTxn ≥ 60` → `REACTIVATE` |
| `REACTIVATE` | Ушёл, возвращаем | `txnCount30d ≥ 1` → `ACTIVATE` |

Пороги — в `THRESHOLDS` в [src/lib/clm-rules.ts](src/lib/clm-rules.ts). **Ручной перевод стадии отсутствует намеренно.**

### Сегментация по размеру

| Категория | Годовой GMV | Команда |
|---|---|---|
| `SMALL` | < 10 млн KGS | B2B → **BRANCH** |
| `MEDIUM` | 10–100 млн KGS | KM → **VB** |
| `LARGE` | ≥ 100 млн KGS | → **KAM** |

### Hunter → Farmer Handoff

После `HANDOFF_DAYS = 60` дней в `ACTIVATE`/`GROW` клиент автоматически передаётся:
- B2B/KM → менеджер целевой команды с минимальной нагрузкой в том же филиале
- `LARGE` → KAM (`managerId = null`)
- Фиксируется в Changelog + Telegram

Запуск: `POST /api/cron/handoff` (03:10) или вручную в `/admin/notifications`.

### Взаимодействия (Activity)

Каждое взаимодействие (звонок/встреча/email) может быть привязано к конкретному банковскому продукту (`product: String?`). Поле заполняется при создании из карточки клиента.

### Health Score, Churn Risk, NBA

Рассчитываются на лету по данным клиента. Источники: [health-score.ts](src/lib/health-score.ts), [churn-risk.ts](src/lib/churn-risk.ts), [nba.ts](src/lib/nba.ts).

---

## Роли пользователей

| Роль | Доступ |
|---|---|
| `ADMIN` | Полный доступ + панель администрирования |
| `DIRECTOR` | Read-only по всем командам + KPI |
| `ANALYST` | Read-only аналитик |
| `TEAM_LEAD` | Вся команда (все клиенты команды) |
| `SUPERVISOR` | Свои подчинённые (по `supervisorId`) |
| `SPECIALIST` | Только свои клиенты (`managerId = me`) |
| `KAM` | Только клиенты, где `kamId = me` |

Row-level фильтрация: [src/lib/access.ts](src/lib/access.ts).
Матрица доступа к чувствительным секциям (financials/credit/txn_metrics/…): `/admin/permissions`.

---

## Cron-задания

Все эндпоинты защищены `Authorization: Bearer ${CRON_SECRET}`.

| Эндпоинт | Расписание | Действие |
|---|---|---|
| `POST /api/cron/rfm-sync` | `0 3 * * *` | Пересчёт RFM-D, стадии, когорты, sizeCategory; захват PortfolioSnapshot |
| `POST /api/cron/event-triggers` | `5 3 * * *` | Задачи по событийным правилам |
| `POST /api/cron/handoff` | `10 3 * * *` | Hunter→Farmer передача |
| `POST /api/cron/escalate` | `0 8 * * *` | Эскалация P1/P2 просроченных >7д |
| `POST /api/cron/reminders` | `0 9 * * *` | Telegram-напоминания |

---

## База данных

Prisma-схема: [prisma/schema.prisma](prisma/schema.prisma)

### Ключевые модели

| Модель | Назначение |
|---|---|
| `Client` | Клиент с RFM-полями, стадией, когортой |
| `User` | Сотрудник (7 ролей, 5 команд) |
| `Branch` | Филиал |
| `Activity` | Взаимодействие (звонок/встреча/email), опц. привязка к продукту |
| `Task` | Задача менеджера (P1/P2/P3, статусы, эскалация) |
| `Deal` | Сделка в pipeline |
| `Changelog` | История изменений клиента |
| `ContactPerson` | Контактные лица клиента |
| `AccountPlan` | Аккаунт-план |
| `ProposalTemplate` | Шаблон коммерческого предложения |
| `PermissionConfig` | Матрица доступа ролей к секциям |
| `PortfolioSnapshot` | Ежедневный снапшот метрик (для трендов) |
| `Product` | Каталог банковских продуктов (управляется через UI) |
| `BranchProductTarget` | Плановые показатели по продукту для филиала (год + **месяц**) |
| `TeamProductTarget` | Плановые показатели по продукту для команды (год + месяц) |

### Миграции

```bash
# Применить все миграции (используйте DIRECT_URL — прямое подключение, не PgBouncer)
npm run db:migrate

# Сгенерировать Prisma-клиент (обязательно после изменений схемы)
npm run db:generate
```

> **Важно**: `prisma generate` и `prisma migrate deploy` требуют прямого подключения к БД.
> Используйте `npm run db:generate` / `npm run db:migrate` — они читают `.env.local` через dotenvx.

Текущие миграции (применяются автоматически):
```
20260526172416_init
20260528000001_add_size_handoff
20260528000002_add_roles
20260528000003_activity_product
20260528000004_portfolio_snapshots
20260528000005_products_monthly
20260528000006_team_targets
```

### Seed-данные

```bash
npm run db:seed   # 3 филиала, 6 пользователей, ~15 клиентов, продукты, планы
```

Дополнительные seed-скрипты (запускаются вручную):
- `prisma/seed-clients.ts` — 200 клиентов с RFM-данными
- `prisma/seed-deals.ts` — сделки для pipeline
- `prisma/seed-permissions.ts` — дефолты матрицы доступа
- `prisma/scripts/` — утилиты и однократные миграции (см. `prisma/scripts/README.md`)

---

## Администрирование (только ADMIN)

| Раздел | Путь | Функционал |
|---|---|---|
| Сотрудники | `/admin/users` | CRUD пользователей, роли, команды, филиалы |
| Матрица доступа | `/admin/permissions` | Видимость секций по ролям |
| Каталог продуктов | `/admin/products?tab=catalog` | Добавить/изменить/удалить продукты |
| Планы по филиалам | `/admin/products?tab=targets&scope=branches` | Помесячные цели: филиал × продукт |
| Планы по командам | `/admin/products?tab=targets&scope=teams` | Помесячные цели: команда × продукт |
| CLM-правила | `/admin/clm-rules` | Просмотр текущих порогов |
| Уведомления | `/admin/notifications` | Telegram, ручной запуск cron |

---

## Telegram-уведомления

Настройка:
1. Создать бота через [@BotFather](https://t.me/BotFather), получить `TELEGRAM_BOT_TOKEN`
2. Узнать `chat_id`: `https://api.telegram.org/bot<TOKEN>/getUpdates`
3. Прописать `chat_id` каждому сотруднику в `/admin/users`

---

## CSV Экспорт

`GET /api/clients/export?stage=ACTIVATE&cohort=ACTIVE&team=B2B&search=ООО`

Поля: ИНН, Название, Тип, Команда, Стадия, Когорта, Дней без транзакций, GMV 30д, Транзакций 30д, Менеджер, KAM, Филиал, +10 продуктовых флагов.

---

## Автоматические последовательности задач

| Последовательность | ID | Применение |
|---|---|---|
| Онбординг | `onboarding` | ONBOARD/ACTIVATE |
| Реактивация | `reactivation` | REACTIVATE/LAPSED |
| Кросс-продажа Эквайринга | `cross-sell-acquiring` | GROW/ACTIVATE |
| Account Plan | `account-plan-grow` | GROW |
| ЗП-проект | `salary-project` | GROW/ACTIVATE |

Дедупликация по полю `triggerDay` — повторный запуск не дублирует задачи.

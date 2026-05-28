# CLM MVP — MBank Corporate CRM

Система управления клиентским циклом (CLM) для корпоративного сегмента MBank Kyrgyzstan. Охватывает полный жизненный цикл клиента: привлечение → онбординг → активация → рост → реактивация.

См. также [LAUNCH.md](LAUNCH.md) — пошаговая инструкция запуска.

---

## Технологический стек

| Слой | Технология |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) — см. [AGENTS.md](AGENTS.md) |
| Language | TypeScript 5 |
| ORM | Prisma 7 + `@prisma/adapter-pg` (custom output `src/generated/prisma`) |
| Database | PostgreSQL + PgBouncer (transaction pooler, порт 6543) |
| Auth | Iron Session (jose JWT-like cookies + bcryptjs) |
| Styling | Tailwind CSS v4 + CSS variables (MBank brand) |
| Notifications | Telegram Bot API + опциональный webhook |
| Cron | Vercel Cron / внешний планировщик |

---

## Архитектура

```
src/
├── app/
│   ├── (app)/                  # Защищённые страницы (требуют сессии)
│   │   ├── dashboard/          # Главный дашборд
│   │   ├── home/               # Стартовая после логина
│   │   ├── clients/            # Реестр клиентов + карточка
│   │   ├── my-portfolio/       # Портфель текущего пользователя
│   │   ├── activation-desk/    # Очередь активации (ONBOARD)
│   │   ├── reactivation/       # Очередь реактивации (REACTIVATE / LAPSED)
│   │   ├── pipeline/           # Сделки B2B / KM
│   │   ├── kpi/                # KPI команд и менеджеров
│   │   ├── kam/                # Портфели KAM
│   │   ├── branches/           # Филиалы + цели по продуктам
│   │   └── admin/              # Настройки (только ADMIN)
│   │       ├── clm-rules/      # Просмотр правил CLM
│   │       ├── kpi/            # Управление KPI
│   │       ├── notifications/  # Telegram + ручной запуск cron
│   │       └── permissions/    # Матрица доступа ролей
│   ├── api/
│   │   ├── auth/logout/        # Завершение сессии
│   │   ├── clients/export/     # CSV выгрузка
│   │   └── cron/               # Автоматические задания (Bearer-защита)
│   │       ├── rfm-sync/       # 03:00 — пересчёт стадий/когорт
│   │       ├── event-triggers/ # 03:05 — событийные задачи
│   │       ├── escalate/       # 08:00 — эскалация просроченных
│   │       └── reminders/      # 09:00 — Telegram-напоминания
│   └── login/
├── lib/
│   ├── actions/                # Server Actions, по домену
│   │   ├── clients.ts          # CRUD клиентов + заметки
│   │   ├── activities.ts       # Звонки/встречи/email
│   │   ├── tasks.ts            # Задачи менеджера
│   │   ├── sequences.ts        # Запуск автоматических последовательностей
│   │   ├── dashboard.ts        # Данные дашборда
│   │   ├── pipeline.ts         # Сделки
│   │   ├── kpi.ts              # KPI агрегаты
│   │   ├── portfolio.ts        # Портфель пользователя
│   │   ├── kam.ts              # Срез по KAM
│   │   ├── activation-desk.ts  # Очередь активации
│   │   ├── reactivation.ts     # Очередь реактивации
│   │   ├── contacts.ts         # Контактные лица
│   │   ├── accountplan.ts      # Account plan
│   │   ├── proposals.ts        # Шаблоны КП
│   │   ├── permissions.ts      # Управление матрицей доступа
│   │   ├── clm-sync.ts         # Серверный триггер RFM-D
│   │   └── admin-triggers.ts   # Ручной запуск cron из UI
│   ├── clm-rules.ts            # ЕДИНСТВЕННЫЙ источник правил CLM
│   ├── clm-config.ts           # Лейблы, цвета стадий
│   ├── rfm-sync.ts             # RFM-D движок (вызов из cron)
│   ├── event-triggers.ts       # Событийные правила → задачи
│   ├── sequences.ts            # Шаблоны последовательностей задач
│   ├── health-score.ts         # Health Score 0–100
│   ├── churn-risk.ts           # Churn Risk 0–100%
│   ├── nba.ts                  # Next Best Action
│   ├── pipeline-config.ts      # Стадии и правила pipeline
│   ├── permissions.ts          # Server-side проверки доступа
│   ├── permissions-config.ts   # Константы матрицы (безопасно в client)
│   ├── notifications.ts        # Telegram + webhook
│   ├── access.ts               # Row-level фильтры (manager/KAM)
│   ├── auth.ts                 # Iron Session helpers
│   └── db.ts                   # Prisma client singleton
├── components/
│   ├── layout/                 # Sidebar, Header
│   ├── clients/                # Виджеты карточки клиента
│   ├── pipeline/               # UI pipeline
│   ├── shared/                 # Переиспользуемые виджеты
│   └── ui/                     # shadcn / base-ui примитивы
└── generated/prisma/           # Prisma-клиент (gitignored)
```

---

## CLM-логика

### Стадии клиента

| Стадия | Смысл | Автопереход (см. `calcStageTransition`) |
|---|---|---|
| `ACQUIRE` | Привлечение — счёт ещё не открыт | Только ручной выход (открытие счёта) |
| `ONBOARD` | Счёт открыт, активности ещё нет | `txnCount30d ≥ 1` и `daysSinceLastTxn ≤ 30` → `ACTIVATE` |
| `ACTIVATE` | Есть транзакции | `txnCount30d ≥ 5` и `gmv30d ≥ 500 000` → `GROW`; `daysSinceLastTxn ≥ 60` → `REACTIVATE` |
| `GROW` | Стабильно активный, высокий оборот | `daysSinceLastTxn ≥ 60` → `REACTIVATE` |
| `REACTIVATE` | Был активен, ушёл | `txnCount30d ≥ 1` и `daysSinceLastTxn ≤ 30` → `ACTIVATE` |

**Стадии назначаются АВТОМАТИЧЕСКИ** ночным RFM-D Sync (`/api/cron/rfm-sync`) на основании транзакционных данных. Ручное переключение стадии в UI отсутствует намеренно. Пороги — в `THRESHOLDS` в [src/lib/clm-rules.ts](src/lib/clm-rules.ts).

### Когорты клиентов (`calcCohort`)

| Когорта | Условие |
|---|---|
| `ACTIVE` | `txnCount30d ≥ 3` |
| `LOW_ACTIVE` | `0 < txnCount30d < 3` |
| `LAPSED` | `txnCount30d = 0` и `daysSinceLastTxn ≥ 60` |
| `NEVER_ACTIVE` | `txnCount30d = 0` и `daysSinceLastTxn < 60` |

Перечисление в `schema.prisma` (enum `CLMCohort`) и логика — синхронны. Правила стадий и когорт — **единственный источник истины**: `src/lib/clm-rules.ts`. Все остальные модули импортируют `calcCohort()` и `calcStageTransition()` из него.

### Health Score (0–100)

Рассчитывается в [src/lib/health-score.ts](src/lib/health-score.ts) по 5 компонентам:

| Компонент | Макс. баллов | Как считается |
|---|---|---|
| Recency | 30 | Линейно от `daysSinceLastTxn` (90д = 0) |
| Frequency | 25 | `txnCount30d × 5`, capped |
| Monetary | 20 | Логарифм от `gmv30d` (потолок ≈ 5M) |
| Depth | 15 | `productDepthPct × 0.15` |
| Engagement | 10 | Активности за 30д × 3, capped |

Grade: ≥70 high · ≥45 medium · ≥20 low · <20 critical.

### Churn Risk (0–100%)

[src/lib/churn-risk.ts](src/lib/churn-risk.ts) — вероятность оттока + список факторов риска.

### Next Best Action

[src/lib/nba.ts](src/lib/nba.ts) — подсказка следующего действия по контексту клиента.

---

## Автоматические последовательности задач

Менеджер запускает одним кликом последовательность шагов из карточки клиента. Все задачи создаются сразу с рассчитанными датами.

| Последовательность | id | Стадия применения |
|---|---|---|
| Онбординг клиента | `onboarding` | ONBOARD / ACTIVATE |
| Реактивация клиента | `reactivation` | REACTIVATE / LAPSED |
| Кросс-продажа Эквайринга | `cross-sell-acquiring` | GROW / ACTIVATE |
| Account Plan (GROW) | `account-plan-grow` | GROW |
| ЗП-проект | `salary-project` | GROW / ACTIVATE |

Дедупликация: каждый шаг создаётся с `triggerDay = seq:{sequenceId}:d{dayOffset}`. Повторный запуск той же последовательности не дублирует задачи.

---

## Cron-задания

Все cron-эндпоинты защищены `Authorization: Bearer ${CRON_SECRET}`.

| Эндпоинт | Расписание | Действие |
|---|---|---|
| `POST /api/cron/rfm-sync` | `0 3 * * *` | Пересчитывает RFM-D для всех клиентов, обновляет стадии и когорты |
| `POST /api/cron/event-triggers` | `5 3 * * *` | Создаёт задачи по событийным правилам |
| `POST /api/cron/escalate` | `0 8 * * *` | Эскалирует P1/P2 задачи просроченные >7 дней, шлёт в Telegram |
| `POST /api/cron/reminders` | `0 9 * * *` | Напоминания менеджерам о задачах на ближайшие 24 часа |

ADMIN может запускать их вручную из `/admin/notifications`.

---

## Роли пользователей

| Роль | Доступ |
|---|---|
| `ADMIN` | Полный доступ ко всем данным, настройкам, ручной запуск cron |
| `ANALYST` | Чтение всех данных, без изменений |
| `MANAGER` | Только свои клиенты (`managerId = me`), создание активностей/задач |
| `KAM_ROLE` | Только клиенты, где `kamId = me` |

Row-level фильтрация — [src/lib/access.ts](src/lib/access.ts).

Матрица доступа к чувствительным секциям (financials / credit / txn_metrics / activities / tasks / changelog) хранится в таблице `permission_configs` и настраивается в `/admin/permissions`. Дефолты — в [src/lib/permissions-config.ts](src/lib/permissions-config.ts) (`DEFAULT_PERMISSIONS`). ADMIN всегда видит всё (проверка в коде, не в БД).

---

## CSV Экспорт

`GET /api/clients/export` — экспорт в CSV (UTF-8 BOM, совместим с Excel).

Параметры: `?stage=ACTIVATE&cohort=ACTIVE&team=B2B&search=ООО`

Поля: ИНН, Название, Тип, Команда, Стадия CLM, Когорта, Дней без транзакций, GMV 30д, Транзакций 30д, Менеджер, KAM, Филиал, +10 продуктовых флагов.

---

## База данных

Prisma-схема: [prisma/schema.prisma](prisma/schema.prisma)

Ключевые модели: `Client`, `User`, `Branch`, `BranchProductTarget`, `Activity`, `Task`, `Deal`, `Changelog`, `ContactPerson`, `AccountPlan`, `PermissionConfig`, `ProposalTemplate`.

Кастомный output Prisma-клиента: `src/generated/prisma` (gitignored — генерируется через `prisma generate`).

Миграции выполняются через прямое подключение (не через PgBouncer):
```bash
DATABASE_URL=$DIRECT_URL npx prisma migrate deploy
```

> ⚠️ В `prisma/migrations/` есть только `20260526172416_init`. Изменения схемы, которые видны в `schema.prisma` (например, `ESCALATED` в `TaskStatus`, таблица `proposal_templates`), исторически применялись скриптом [prisma/scripts/archive/migrate-manual.ts](prisma/scripts/archive/migrate-manual.ts). При накате на свежую БД эти изменения нужно либо перенести в нормальную Prisma-миграцию, либо выполнить скрипт вручную.

### Утилитные скрипты в `prisma/`

- `seed.ts` — канонический seed (`npm run db:seed`): 3 филиала, 6 пользователей, ~15 клиентов, задачи активации, цели филиалов по продуктам.
- `seed-clients.ts` — расширенный seed на 200 клиентов с консистентными RFM-данными (не подключён к `db:seed`, запускается вручную).
- `seed-deals.ts` — генерация сделок для pipeline.
- `seed-permissions.ts` — инициализация `permission_configs` дефолтами.
- `scripts/` — утилиты (`update-passwords.ts`) и `scripts/archive/` — однократные миграции данных (см. [prisma/scripts/README.md](prisma/scripts/README.md)).

---

## Telegram-уведомления

Настраиваются в `/admin/notifications`:
- Webhook URL: `https://api.telegram.org/bot{TOKEN}/setWebhook?url={APP_URL}/api/telegram`
- У каждого пользователя может быть `telegramChatId`
- Уведомления: эскалации (D+7), напоминания о задачах (09:00)

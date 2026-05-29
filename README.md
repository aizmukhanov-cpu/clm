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
│   │   │   └── [id]/              # Карточка: KYC-чеклист, активности, задачи, КП
│   │   ├── my-portfolio/          # Портфель текущего пользователя
│   │   ├── my-tasks/              # Мои задачи
│   │   ├── activation-desk/       # Очередь активации (ONBOARD)
│   │   ├── reactivation/          # Очередь реактивации (REACTIVATE/LAPSED)
│   │   ├── pipeline/              # Сделки B2B / KM (с шаблонами КП)
│   │   ├── kpi/                   # KPI команд и менеджеров + тренды
│   │   │   ├── funnel/            # Воронка Pipeline по командам + топ причин потерь
│   │   │   └── leaderboard/       # Геймификация: рейтинг внутри команд + по филиалам
│   │   ├── kam/                   # Портфели KAM
│   │   ├── branches/              # Филиалы
│   │   │   └── [id]/              # Дашборд директора: цели, KPI менеджеров, доля рынка
│   │   └── admin/                 # Только ADMIN
│   │       ├── users/             # CRUD сотрудников + перераспределение портфеля
│   │       ├── permissions/       # Матрица доступа ролей
│   │       ├── products/          # Каталог продуктов + помесячные планы
│   │       ├── clm-rules/         # Просмотр правил CLM
│   │       ├── kpi/               # Управление KPI
│   │       └── notifications/     # Telegram + ручной запуск cron
│   ├── api/
│   │   ├── auth/logout/
│   │   ├── clients/export/        # CSV выгрузка
│   │   └── cron/                  # Bearer-защищённые задания
│   │       ├── rfm-sync/          # 03:00 — пересчёт стадий/когорт
│   │       ├── event-triggers/    # 03:05 — событийные задачи + ghosting + QBR
│   │       ├── handoff/           # 03:10 — Hunter→Farmer передача
│   │       ├── escalate/          # 08:00 — эскалация просроченных
│   │       ├── reminders/         # 09:00 — Telegram-напоминания
│   │       ├── midmonth-alert/    # 09:10 каждое 15-е — алерт план/факт
│   │       └── monthly-snapshot/  # 04:00 каждое 1-е — снапшот KPI менеджеров
│   └── login/
├── lib/
│   ├── actions/                   # Server Actions
│   │   ├── clients.ts
│   │   ├── activities.ts          # Взаимодействия (CALL/MEETING/EMAIL/WHATSAPP/VISIT)
│   │   ├── tasks.ts
│   │   ├── dashboard.ts           # Данные дашборда + тренды
│   │   ├── pipeline.ts
│   │   ├── pipeline-analytics.ts  # Воронка + статистика причин потерь
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
│   │   ├── kyc.ts                 # KYC-чеклист клиента (7 пунктов)
│   │   ├── gamification.ts        # Рейтинги (команды, филиалы) + достижения
│   │   ├── clm-sync.ts
│   │   ├── admin-triggers.ts
│   │   ├── admin-users.ts         # CRUD сотрудников + reassignPortfolio
│   │   └── admin-products.ts      # Каталог продуктов + планы
│   ├── clm-rules.ts               # ЕДИНСТВЕННЫЙ источник правил CLM
│   ├── clm-config.ts
│   ├── rfm-sync.ts
│   ├── event-triggers.ts          # Правила: реактивация/кросс-продажи/QBR/ghosting/ничейные
│   ├── sequences.ts
│   ├── hunter-handoff.ts          # Hunter→Farmer логика
│   ├── health-score.ts
│   ├── churn-risk.ts
│   ├── nba.ts
│   ├── pipeline-config.ts
│   ├── permissions.ts
│   ├── permissions-config.ts
│   ├── product-config.ts
│   ├── task-labels.ts
│   ├── notifications.ts           # Групповые + персональные Telegram-уведомления
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

Типы: `CALL` / `MEETING` / `EMAIL` / `WHATSAPP` / `VISIT`

Каждое взаимодействие может быть привязано к конкретному продукту и/или сделке (`dealId`). Флаги `isPlanned` / `completedAt` поддерживают плановые активности.

### Событийные триггеры (Event Triggers)

Правила в [src/lib/event-triggers.ts](src/lib/event-triggers.ts), запускаются в 03:05 ежедневно:

| Триггер | Условие | Действие |
|---|---|---|
| `unowned-client` | Клиент без менеджера вне стадии ACQUIRE | P1-задача на ADMIN |
| `reactivation-30d` | 30 дней без транзакций | Задача менеджеру |
| `reactivation-60d` | 60 дней без транзакций (LAPSED) | Задача менеджеру |
| `cross-sell` | Нет определённых продуктов в GROW | Задача на кросс-продажу |
| `qbr-overdue` | AccountPlan.nextMeeting просрочен | Задача на проведение QBR |
| `ghosting` | Сделка без активности 21+ дней | P2-задача по сделке |

Дедупликация по `triggerDay` — повторный запуск не дублирует задачи.

### KYC-чеклист

На карточке каждого клиента — 7 обязательных пунктов:

| Пункт | Статусы |
|---|---|
| ИНН подтверждён | PENDING / DONE / N_A |
| Устав / учредительные документы | |
| Паспорт директора | |
| Бенефициарный владелец | |
| Свидетельство о налоговой регистрации | |
| AML-проверка пройдена | |
| Юридический адрес подтверждён | |

Прогресс-бар показывает % выполненных пунктов. Обновление — прямо на карточке клиента.

### Pipeline: Воронка и причины потерь

`/kpi/funnel` — агрегированная воронка по командам (B2B/KM/BRANCH):
- Конверсия между стадиями (green ≥50% / amber ≥25% / red <25%)
- Топ причин потери сделок из `lostReasonCode`

Стандартные коды причин потери: `PRICE`, `COMPETITOR`, `NO_NEED`, `TIMING`, `NO_BUDGET`, `DOCS_MISSING`, `AML_DECLINED`, `CONTACT_LOST`, `OTHER`.

### Мидмесячный алерт (15-е число)

`POST /api/cron/midmonth-alert` — сравнивает фактические активации (1–15 число) с половиной плана:
- Если факт < 30% от плановой половины → P1-задача менеджеру + личное Telegram-сообщение
- Итоговая сводка → групповой Telegram-канал

### Снапшот KPI менеджеров (1-е число)

`POST /api/cron/monthly-snapshot` — сохраняет KPI предыдущего месяца в `ManagerMonthlySnapshot` для каждого SPECIALIST/KAM/SUPERVISOR.

### Health Score, Churn Risk, NBA

Рассчитываются на лету. Источники: [health-score.ts](src/lib/health-score.ts), [churn-risk.ts](src/lib/churn-risk.ts), [nba.ts](src/lib/nba.ts).

---

## Роли пользователей

| Роль | Доступ |
|---|---|
| `ADMIN` | Полный доступ + панель администрирования |
| `DIRECTOR` | Read-only по всем командам + KPI + рейтинги |
| `ANALYST` | Read-only аналитик + рейтинги |
| `TEAM_LEAD` | Вся команда + рейтинги (все команды) |
| `SUPERVISOR` | Свои подчинённые (по `supervisorId`) |
| `SPECIALIST` | Только свои клиенты + рейтинг своей команды |
| `KAM` | Только клиенты, где `kamId = me` + рейтинг своей команды |

Row-level фильтрация: [src/lib/access.ts](src/lib/access.ts).
Матрица доступа к чувствительным секциям (financials/credit/txn_metrics/…): `/admin/permissions`.

---

## Геймификация

`/kpi/leaderboard` — соревнование **внутри команды** и **между филиалами**:

- **Рейтинг команды**: SPECIALIST/KAM видят только свою команду; ADMIN/DIRECTOR/ANALYST/TEAM_LEAD — все команды
- **Рейтинг филиалов**: все роли; агрегируется по среднему баллу менеджеров филиала
- **Очки**: `активации × 10 + контакты + % активации портфеля × 0.5`
- **Тренд**: ↑/↓/→ относительно прошлого месяца

**Достижения (10 бейджей)** — бронза/серебро/золото на основе активаций, активности и % портфеля. Просроченные задачи снимают бейдж «Нет просрочек».

---

## Дашборд директора филиала

`/branches/[id]` — доступен ADMIN / DIRECTOR / ANALYST / TEAM_LEAD своего филиала:
- Целевые показатели по продуктам: план / факт / % / прогресс-бар
- Доля рынка (если заполнено `marketSharePct`)
- Таблица менеджеров: клиенты, активации, % плана, контакты, просроченные задачи

---

## Cron-задания

Все эндпоинты защищены `Authorization: Bearer ${CRON_SECRET}`.

| Эндпоинт | Расписание | Действие |
|---|---|---|
| `POST /api/cron/rfm-sync` | `0 3 * * *` | Пересчёт RFM-D, стадии, когорты, sizeCategory; захват PortfolioSnapshot |
| `POST /api/cron/event-triggers` | `5 3 * * *` | Задачи по событийным правилам + ghosting + QBR + ничейные клиенты |
| `POST /api/cron/handoff` | `10 3 * * *` | Hunter→Farmer передача |
| `POST /api/cron/escalate` | `0 8 * * *` | Эскалация P1/P2 просроченных >7д |
| `POST /api/cron/reminders` | `0 9 * * *` | Telegram-напоминания |
| `POST /api/cron/midmonth-alert` | `10 9 15 * *` | Алерт план/факт по активациям (15-е число) |
| `POST /api/cron/monthly-snapshot` | `0 4 1 * *` | Снапшот KPI менеджеров (1-е число) |

---

## База данных

Prisma-схема: [prisma/schema.prisma](prisma/schema.prisma)

### Ключевые модели

| Модель | Назначение |
|---|---|
| `Client` | Клиент с RFM-полями, стадией, когортой, `firstTxnAt` |
| `User` | Сотрудник (7 ролей, 5 команд); + `planMonthly`, `telegramChatId` |
| `Branch` | Филиал; + `marketCapacityYL`, `marketCapacityIP`, `marketSharePct` |
| `Activity` | Взаимодействие (5 типов: CALL/MEETING/EMAIL/WHATSAPP/VISIT); + `dealId`, `isPlanned`, `completedAt` |
| `Task` | Задача менеджера (P1/P2/P3, статусы, эскалация) |
| `Deal` | Сделка в pipeline; + `lostReasonCode` (9 стандартных значений) |
| `Changelog` | История изменений клиента |
| `ContactPerson` | Контактные лица клиента |
| `AccountPlan` | Аккаунт-план |
| `KYCChecklist` | KYC-чеклист клиента (7 пунктов, статус PENDING/DONE/N_A) |
| `Merchant` | Торговые точки клиента |
| `ManagerMonthlySnapshot` | Ежемесячный снапшот KPI менеджера |
| `ProposalTemplate` | Шаблон коммерческого предложения |
| `PermissionConfig` | Матрица доступа ролей к секциям |
| `PortfolioSnapshot` | Ежедневный снапшот метрик (для трендов) |
| `Product` | Каталог банковских продуктов |
| `BranchProductTarget` | Плановые показатели по продукту для филиала (год + месяц) |
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
20260528000007_p1p2_features      ← ActivityType WHATSAPP/VISIT, KYCChecklist, Merchant,
                                     ManagerMonthlySnapshot, DealLostReason, KYCItemStatus
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
| Сотрудники | `/admin/users` | CRUD пользователей + перераспределение портфеля (авто / на конкретного менеджера) |
| Матрица доступа | `/admin/permissions` | Видимость секций по ролям |
| Каталог продуктов | `/admin/products?tab=catalog` | Добавить/изменить/удалить продукты |
| Планы по филиалам | `/admin/products?tab=targets&scope=branches` | Помесячные цели: филиал × продукт |
| Планы по командам | `/admin/products?tab=targets&scope=teams` | Помесячные цели: команда × продукт |
| CLM-правила | `/admin/clm-rules` | Просмотр текущих порогов |
| Уведомления | `/admin/notifications` | Telegram, ручной запуск всех cron-заданий |

### Перераспределение портфеля

`/admin/users` → кнопка **«Перераспределить портфель»**:
- **Авто** — клиенты менеджера распределяются по коллегам той же команды/филиала, равномерно по нагрузке
- **На конкретного** — все клиенты переходят одному выбранному менеджеру
- Каждая передача фиксируется в Changelog

---

## Telegram-уведомления

Два канала:
- **Групповой** (`TELEGRAM_CHAT_ID`) — итоги cron-заданий, мидмесячный алерт
- **Личный** (`user.telegramChatId`) — персональные алерты по плану активаций

Настройка:
1. Создать бота через [@BotFather](https://t.me/BotFather), получить `TELEGRAM_BOT_TOKEN`
2. Узнать `chat_id`: `https://api.telegram.org/bot<TOKEN>/getUpdates`
3. Прописать личный `chat_id` каждому сотруднику в `/admin/users`

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

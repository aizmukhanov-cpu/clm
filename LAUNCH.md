# Запуск CLM MVP

Пошаговая инструкция для новой команды.

---

## Требования

- Node.js ≥ 20
- PostgreSQL 15+ (или Supabase — рекомендуется)
- PgBouncer (опционально, рекомендуется для production)

---

## 1. Клонирование

```bash
git clone <repo-url> clm-mvp
cd clm-mvp
npm install
```

---

## 2. Переменные окружения

Создайте `.env.local` в корне проекта:

```env
# ── База данных ────────────────────────────────────────────
# Подключение через PgBouncer (transaction pooler, порт 6543)
DATABASE_URL=postgresql://user:password@host:6543/dbname?pgbouncer=true

# Прямое подключение для Prisma (migrations + generate, порт 5432)
DIRECT_URL=postgresql://user:password@host:5432/dbname

# ── Auth ──────────────────────────────────────────────────
# Секрет для Iron Session — минимум 32 символа, любая случайная строка
JWT_SECRET=your-super-secret-min-32-chars-here

# ── Cron защита ───────────────────────────────────────────
# Bearer token для /api/cron/* эндпоинтов
CRON_SECRET=your-cron-secret-string

# ── Telegram Bot (опционально) ────────────────────────────
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrSTUvwxyz
TELEGRAM_CHAT_ID=123456789

# ── Webhook (опционально) ─────────────────────────────────
NOTIFICATION_WEBHOOK_URL=https://your-webhook-url.com/notify
```

> **PgBouncer**: `DATABASE_URL` — порт 6543 (transaction pooler). `DIRECT_URL` — порт 5432 (прямое PG, нужно для migrate и generate). Если используете Supabase — оба URL есть в Settings → Database.

---

## 3. База данных

### Новая установка

```bash
# 1. Применить все миграции
npm run db:migrate

# 2. Сгенерировать Prisma-клиент
npm run db:generate

# 3. Заполнить тестовыми данными
npm run db:seed
```

Seed создаёт: 3 филиала, 6 пользователей, ~15 клиентов, каталог продуктов, плановые показатели.

### Системный пользователь для cron (обязательно)

Выполните в psql / Supabase SQL Editor:

```sql
INSERT INTO users (id, name, email, role, team, branch_id, password_hash)
SELECT
  gen_random_uuid()::text,
  'CLM Automation',
  'clm-automation',
  'ADMIN',
  'B2B',
  (SELECT id FROM branches LIMIT 1),
  'not-a-real-password'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'clm-automation');
```

Этот пользователь фигурирует в changelog-записях при автоматическом RFM-D sync.

---

## 4. Запуск

```bash
# Dev (с Turbopack)
npm run dev

# Production build + start
npm run build
npm start
```

Приложение: [http://localhost:3000](http://localhost:3000)

---

## 5. Тестовые учётные записи

После `db:seed`. Пароль у всех: `password123`

| Email | Роль | Команда |
|---|---|---|
| `admin@mbank.kg` | ADMIN | VB |
| `analyst@mbank.kg` | ANALYST | VB |
| `b2b@mbank.kg` | SPECIALIST | B2B |
| `km@mbank.kg` | SPECIALIST | KM |
| `kam@mbank.kg` | KAM | KAM |
| `branch@mbank.kg` | SPECIALIST | BRANCH |

---

## 6. Cron-задания

### Вариант A: Vercel Cron (`vercel.json`)

```json
{
  "crons": [
    { "path": "/api/cron/rfm-sync",         "schedule": "0 3 * * *"   },
    { "path": "/api/cron/event-triggers",   "schedule": "5 3 * * *"   },
    { "path": "/api/cron/handoff",          "schedule": "10 3 * * *"  },
    { "path": "/api/cron/escalate",         "schedule": "0 8 * * *"   },
    { "path": "/api/cron/reminders",        "schedule": "0 9 * * *"   },
    { "path": "/api/cron/midmonth-alert",   "schedule": "10 9 15 * *" },
    { "path": "/api/cron/monthly-snapshot", "schedule": "0 4 1 * *"   }
  ]
}
```

### Вариант B: Внешний cURL

```bash
curl -X POST https://your-app.com/api/cron/rfm-sync \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Ручной запуск

`/admin/notifications` → кнопки ручного запуска (только ADMIN).

---

## 7. Telegram

1. Создать бота: [@BotFather](https://t.me/BotFather) → получить `TELEGRAM_BOT_TOKEN`
2. Узнать `chat_id`: `https://api.telegram.org/bot<TOKEN>/getUpdates`
3. Прописать `chat_id` каждому сотруднику в `/admin/users`

---

## 8. Обновление схемы

При изменении `prisma/schema.prisma`:

```bash
# Создать migration (dev)
dotenvx run -f .env.local -- node_modules/.bin/prisma migrate dev --name describe_change

# Применить на prod
npm run db:migrate

# Регенерировать клиент
npm run db:generate
```

> `npx prisma generate` **не работает** с Node.js 22 из-за несовместимости js-yaml в Prisma CLI.
> Всегда используйте `npm run db:generate` (через `node_modules/.bin/prisma`).

---

## Частые проблемы

| Ошибка | Решение |
|---|---|
| `prepared statement already exists` | `DATABASE_URL` должен содержать `?pgbouncer=true` |
| `Can't reach database server` | Проверьте порты: 6543 (pooler) для `DATABASE_URL`, 5432 для `DIRECT_URL` |
| Cron не запускается | `CRON_SECRET` в `.env.local` должен совпадать с Bearer-токеном |
| `prisma generate` ничего не делает | Используйте `npm run db:generate` |
| Build ошибка `turbopackBuild is not a function` | `NODE_OPTIONS="--max-old-space-size=4096" npm run build` |

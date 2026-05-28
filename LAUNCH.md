# Инструкция по запуску CLM MVP

## Требования

- Node.js >= 20
- PostgreSQL 15+ (или Supabase)
- PgBouncer (опционально, рекомендуется для production)

---

## 1. Установка зависимостей

```bash
cd clm-mvp
npm install
```

---

## 2. Переменные окружения

Создайте файл `.env.local` в корне проекта:

```env
# ── База данных ────────────────────────────────────────────
# Подключение через PgBouncer (transaction pooler, порт 6543)
DATABASE_URL=postgres://user:password@host:6543/dbname?pgbouncer=true&connection_limit=1

# Прямое подключение для Prisma migrations (порт 5432)
DIRECT_URL=postgres://user:password@host:5432/dbname

# ── Auth ──────────────────────────────────────────────────
# Секрет для Iron Session (минимум 32 символа)
JWT_SECRET=your-super-secret-min-32-chars-here

# ── Telegram Bot (опционально) ────────────────────────────
# Создать бота через @BotFather
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrSTUvwxyz

# ID чата администратора (для тестирования)
TELEGRAM_CHAT_ID=123456789

# ── Cron защита ───────────────────────────────────────────
# Любая случайная строка, используется как Bearer token
CRON_SECRET=your-cron-secret-string

# ── Supabase (если используется Supabase вместо прямого PG) ─
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# ── Webhook уведомления (опционально) ─────────────────────
NOTIFICATION_WEBHOOK_URL=https://your-webhook-url.com/notify
```

> **Важно**: Если используется PgBouncer в режиме transaction pooling, Prisma migrations запускать только через `DIRECT_URL`. Иначе команды `BEGIN`/`COMMIT` вызовут ошибки.

---

## 3. База данных

### Новая установка

```bash
# Применить все migrations
DATABASE_URL=$DIRECT_URL npx prisma migrate deploy

# Сгенерировать Prisma client
npx prisma generate

# Заполнить базу тестовыми данными (3 филиала, ~15 клиентов, KPI-цели)
npm run db:seed
```

### Добавление системного пользователя для cron

```sql
-- Выполнить в psql или Supabase SQL Editor
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

> Этот пользователь используется в changelog-записях при автоматическом RFM-D sync. Без него изменения стадий не будут записаны в историю.

---

## 4. Запуск dev-сервера

```bash
npm run dev
```

Приложение доступно на [http://localhost:3000](http://localhost:3000)

> Используется Turbopack с отключённым persistent caching (`TURBOPACK_DISABLE_PERSISTENT_CACHING=1`) для предотвращения stale-состояний при разработке.

---

## 5. Тестовые учётные записи

После `db:seed` доступны следующие аккаунты:

Все пароли — `password123`.

| Email | Роль | Команда |
|---|---|---|
| `admin@mbank.kg` | ADMIN | VB |
| `analyst@mbank.kg` | ANALYST | VB |
| `b2b@mbank.kg` | MANAGER | B2B |
| `km@mbank.kg` | MANAGER | KM |
| `kam@mbank.kg` | KAM_ROLE | KAM |
| `branch@mbank.kg` | MANAGER | BRANCH |

---

## 6. Настройка cron-заданий

### Вариант A: Vercel Cron

Добавить в `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/rfm-sync",
      "schedule": "0 3 * * *"
    },
    {
      "path": "/api/cron/event-triggers",
      "schedule": "5 3 * * *"
    },
    {
      "path": "/api/cron/escalate",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/reminders",
      "schedule": "0 9 * * *"
    }
  ]
}
```

### Вариант B: Внешний планировщик (cURL)

```bash
# RFM-D Sync — 03:00 ежедневно
curl -X POST https://your-app.com/api/cron/rfm-sync \
  -H "Authorization: Bearer $CRON_SECRET"

# Event Triggers — 03:05 ежедневно
curl -X POST https://your-app.com/api/cron/event-triggers \
  -H "Authorization: Bearer $CRON_SECRET"

# Escalate — 08:00 ежедневно
curl -X POST https://your-app.com/api/cron/escalate \
  -H "Authorization: Bearer $CRON_SECRET"

# Reminders — 09:00 ежедневно
curl -X POST https://your-app.com/api/cron/reminders \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Ручной запуск (для тестирования)

В интерфейсе: `/admin/notifications` → кнопки ручного запуска (только для ADMIN).

---

## 7. Настройка Telegram-уведомлений

1. Создать бота через [@BotFather](https://t.me/BotFather) → получить `TELEGRAM_BOT_TOKEN`
2. Узнать `chat_id` администратора:
   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```
3. Добавить `chat_id` каждому менеджеру в `/admin/users`
4. Опционально настроить webhook:
   ```
   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-app.com/api/telegram
   ```

---

## 8. Production build

```bash
npm run build
npm run start
```

Или деплой на Vercel:
```bash
npx vercel --prod
```

---

## 9. Обновление Prisma-клиента

При изменении `prisma/schema.prisma`:

```bash
# Создать и применить migration
DATABASE_URL=$DIRECT_URL npx prisma migrate dev --name describe_change

# Или только применить существующие
DATABASE_URL=$DIRECT_URL npx prisma migrate deploy

# Регенерировать client
npx prisma generate
```

---

## Частые проблемы

### `prepared statement already exists`
PgBouncer в transaction mode не поддерживает prepared statements. Убедитесь, что `DATABASE_URL` содержит `?pgbouncer=true`.

### `Can't reach database server`
Проверьте что `DATABASE_URL` использует порт 6543 (PgBouncer), а `DIRECT_URL` — 5432 (прямое PG).

### Cron не запускается
Проверьте что `CRON_SECRET` в `.env.local` совпадает с тем, что передаётся в `Authorization: Bearer ...`.

### Prisma migration зависает
Всегда запускайте migrations через прямое подключение: `DATABASE_URL=$DIRECT_URL npx prisma migrate deploy`

# NioBot Meet recording integration

Niolla schedules auto-recording via [NioBot-Meet](https://github.com/SathiraSriSathsara/NioBot-Meet) (separate service).

## 1. Run NioBot (sibling folder)

**Important:** The folder name has a space (`Niolla nexa`). Always wrap paths in quotes.

```powershell
cd "C:\Users\User\Desktop\Niolla nexa\NioBot-Meet"
npm install
npx playwright install chromium
Copy-Item sample.env .env
# Edit .env: DB_PASS, BOT_EMAIL, BOT_PASS, RECORDING_MODE=playwright
```

### Create MySQL database (Windows PowerShell)

PowerShell does **not** support `mysql ... < schema.sql`. Use one of these:

**Option A — PowerShell (from NioBot-Meet folder):**
```powershell
cd "C:\Users\User\Desktop\Niolla nexa\NioBot-Meet"
Get-Content ".\schema.sql" -Raw | & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p
```

**Option B — CMD (note `/d` and quotes):**
```cmd
cd /d "C:\Users\User\Desktop\Niolla nexa\NioBot-Meet"
"C:\wamp64\bin\mysql\mysql8.0.31\bin\mysql.exe" -u root -p < schema.sql
```
(WAMP default root password is often **empty** — press Enter at the password prompt.)

Set in NioBot `.env`:
```env
DB_PASS=
```
If you see `Access denied for user 'root'@'localhost' (using password: YES)`, the password in `.env` is wrong — leave `DB_PASS` empty for WAMP.

`schema.sql` creates the `meetrecorder` database automatically. If you see **No database selected**, pull the latest `schema.sql` or run:
```cmd
"C:\wamp64\bin\mysql\mysql8.0.31\bin\mysql.exe" -u root -p -e "CREATE DATABASE IF NOT EXISTS meetrecorder;"
"C:\wamp64\bin\mysql\mysql8.0.31\bin\mysql.exe" -u root -p meetrecorder < schema.sql
```

**Option C — MySQL Workbench:** open `schema.sql` and execute it.

Adjust the `mysql.exe` path to match your install (or add MySQL `bin` to PATH).

### `ERROR 2003` — MySQL not running

If you see `Can't connect to MySQL server on 'localhost:3306' (10061)`, the database server is **stopped**.

**WAMP:** click the WAMP tray icon → **Start All Services** (or MySQL only).  
Or open **CMD as Administrator** and run: `net start wampmysqld64`

**XAMPP:** open XAMPP Control Panel → **Start** next to MySQL.

**MySQL Server 8.0 (standalone):** open **Services** (`services.msc`) → start **MySQL80**, or reinstall MySQL and choose “Configure as Windows Service”.

Then re-run the `schema.sql` import.

Then start NioBot:
```powershell
npm run start:api      # port 5055
npm run start:worker   # second terminal
```

Windows: set `RECORDING_MODE=playwright` and `PLAYWRIGHT_HEADLESS=false` in `.env`.

### Google sign-in for the bot (required once)

Google **blocks** sign-in inside Playwright’s bundled Chromium (“This browser or app may not be secure”). You must save a session once using **real Google Chrome**:

```powershell
cd "C:\Users\User\Desktop\Niolla nexa\NioBot-Meet"
npm run auth:google
```

Chrome opens. Sign in as `niollateam@gmail.com` (complete MFA if asked), then press **Enter** in the terminal. This saves `.auth/google.json`. Future recordings reuse that session and skip sign-in.

Requires **Google Chrome** installed (not only Playwright Chromium). Optional in `.env`:

```env
PLAYWRIGHT_CHANNEL=chrome
```

**Guest mode (no Google account):** set `JOIN_AS_GUEST=true` in NioBot `.env` — the bot joins as “NioBot Recorder” (host must admit the guest).

## 2. Niolla backend `.env`

```env
NIOBOT_API_URL=http://localhost:5055
NIOBOT_ENABLED=true
```

## 3. Flow

1. Create meeting in Niolla (Inquiry → Create Meeting, **Auto-record** checked).
2. Niolla calls `POST /meetings` on NioBot with Meet link + Colombo schedule time.
3. Worker joins, records via Playwright, transcodes to 720p/480p/HLS.
4. Meeting detail page polls and shows **Watch recording** link when ready.

## API (NioBot)

- `POST /meetings` — schedule
- `GET /recordings?meeting_id=<uuid>` — status + `watch_url`, `download_url`
- `GET /media/...` — stream MP4/HLS

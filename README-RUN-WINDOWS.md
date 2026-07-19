# Run TrackBetter on Windows

## Recommended method

1. Extract the ZIP into a new empty folder.
2. Open PowerShell in that folder.
3. Run:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

4. Open the local URL printed by Next.js, normally `http://localhost:3000`.

The package includes a public npm `package-lock.json`, so `npm ci` installs the exact validated dependencies.

## Automatic script

Double-click:

```text
RUN-WINDOWS.cmd
```

It removes incomplete local dependencies, runs `npm ci`, creates `.env.local`, and starts the development server. If npm fails, it tries pnpm through Corepack.

## If port 3000 is already in use

Next.js automatically chooses another port such as `3001`. Open the exact URL printed after `Local:`.

## Environment file

Fill `.env.local` with Firebase Web, Firebase Admin, Gmail App Password and `CRON_SECRET` values. Without Firebase Web variables the interface runs in local browser mode; Google login and cloud synchronization require Firebase configuration.

# SimpleSaltwater

Fiskeforhold-app for saltvannsfiskere. Viser fiskepoeng (0–100), 3-dagers utsikt, beste tider og estimert tidevann.

## Stack

- **Next.js 14** (App Router) — frontend og routing
- **Supabase** — auth og database
- **Vercel** — hosting (auto-deploy fra GitHub)
- **Open-Meteo** — gratis vær-API, ingen nøkkel
- **Nominatim** — gratis stedssøk, ingen nøkkel

## Kom i gang

### 1. Installer avhengigheter

```bash
npm install
```

### 2. Sett opp Supabase

1. Opprett et prosjekt på [supabase.com](https://supabase.com)
2. Gå til **SQL Editor** og kjør innholdet i `supabase-setup.sql`
3. Kopier **Project URL** og **anon key** fra Settings → API

### 3. Miljøvariabler

Kopier eksempelfilen og fyll inn dine verdier:

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://ditt-prosjekt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=din-anon-nøkkel
```

### 4. Kjør lokalt

```bash
npm run dev
```

Åpne [http://localhost:3000](http://localhost:3000)

## Deploy til Vercel

1. Push koden til GitHub
2. Koble repoet til [vercel.com](https://vercel.com)
3. Legg til miljøvariablene i Vercel Dashboard → Settings → Environment Variables
4. Vercel deployer automatisk ved hver push til `main`

## Filstruktur

```
simplesaltwater/
├── app/
│   ├── layout.tsx          — Root layout + metadata
│   ├── page.tsx            — Hovedside (server component)
│   ├── globals.css         — Tailwind base styles
│   ├── auth/
│   │   └── page.tsx        — Login / registrering
│   └── log/
│       └── page.tsx        — Fiskelogg (krever innlogging)
├── components/
│   ├── MainApp.tsx         — Hovedapp (client component)
│   ├── LocationSearch.tsx  — Stedssøk med autocomplete
│   ├── ThreeDayForecast.tsx — 3-dagers dagvelger
│   ├── FavoritesList.tsx   — Lagrede steder
│   └── FishingLogForm.tsx  — Logg fiskeøkt
├── lib/
│   ├── supabase/
│   │   ├── client.ts       — Supabase browser-klient
│   │   └── server.ts       — Supabase server-klient
│   └── fishing-score.ts    — All scorelogikk
└── supabase-setup.sql      — Kjør dette i Supabase SQL Editor
```

## Scoring

| Faktor      | Vekt | Beste verdi          |
|-------------|------|----------------------|
| Vind        | 30%  | 3–15 km/t            |
| Tidspunkt   | 30%  | Tidlig morgen/kveld  |
| Skydekke    | 20%  | 10–40%               |
| Temperatur  | 20%  | 10–24°C              |

# Supabase + Vercel paleidimas

## 1. Susikurk Supabase projektą
- Eik į `supabase.com`
- Susikurk naują projektą
- Atsidaryk `SQL Editor`
- Įvykdyk failą [supabase/schema.sql](/C:/Users/kodas/Documents/New%20project%206/supabase/schema.sql)

## 2. Pasiimk raktus
Supabase projekto nustatymuose reikės:
- `Project URL`
- `anon public key`
- `service_role key`

## 3. Lokalus `.env.local`
Susikurk `.env.local` pagal [`.env.example`](/C:/Users/kodas/Documents/New%20project%206/.env.example):

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## 4. Lokalus paleidimas
```bash
npm install
npm run dev
```

## 5. Įkelk į GitHub
Rekomenduojama:
- sukurti naują GitHub repo
- įkelti visą projektą

## 6. Deploy į Vercel
- Eik į `vercel.com`
- Importuok GitHub repo
- Pridėk šiuos `Environment Variables`:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Paleisk deploy

## 7. Prijunk domeną
- Vercel projekte atsidaryk `Domains`
- Pridėk savo domeną
- DNS nukreipimus susitvarkyk pagal Vercel nurodymus

## 8. Svarbi pastaba
Ši versija naudoja vieną bendrą `event_state` JSON įrašą Supabase lentelėje.
Tai veikiantis MVP variantas mažam renginiui, bet jei norėsi daugiau patikimumo ir mažesnės konfliktų rizikos, kitas žingsnis būtų normalizuoti duomenis į atskiras lenteles:
- `reservations`
- `reservation_people`
- `votes`
- `transfers`
- `song_suggestions`
- `event_ideas`

## 9. Prieš siunčiant žmonėms
Būtinai pasitikrink:
- ar registracija iš vieno telefono matoma kitame
- ar admin pažymėtas apmokėjimas atsiranda svečių lentoje
- ar QR tikrinimas veikia iš kito įrenginio

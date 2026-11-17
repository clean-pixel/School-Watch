# SchulWatch One

**Schule. Einfach. Digital.** – Next.js App Router, TypeScript, Tailwind CSS und Supabase.

> Sicherheitsorientierter MVP mit öffentlicher Website, Supabase Auth, rollenbasierten Bereichen, PostgreSQL-Schema und Row Level Security. Bitte die Statusangaben in der Projektdokumentation nicht als Produktionsfreigabe verstehen.

## Lokal starten

1. Node.js 20+ installieren und `npm install` ausführen.
2. Supabase SQL Editor öffnen und die Migrationen unter `supabase/migrations/` in Nummernreihenfolge ausführen. Für ein bereits eingerichtetes Projekt nur noch nicht angewendete Migrationen ausführen.
3. `.env.example` nach `.env.local` kopieren und URL sowie Publishable/anon-Key eintragen. Keinen Service-Role-Key im Browser oder Repository verwenden.
4. Supabase Auth Site URL auf `http://localhost:3000` setzen und `/auth/callback` als Redirect URL erlauben. Wenn E-Mail-Verifizierung aktiviert ist, muss der Registrierungslink angeklickt werden.
5. `npm run dev` starten.

## Registrierung und Freigabe

- Eine Schulregistrierung erstellt sofort die Schule und das Schulleitungskonto. Es entsteht kein Schulregistrierungsantrag.
- Schüler wählen eine bestehende Schule und werden sofort zugeordnet.
- Lehrkräfte wählen eine bestehende Schule; ihr Zugang bleibt bis zur Freigabe durch die Schulleitung gesperrt.
- Lehrkraft-Anmeldungen verwaltet die Schulleitung unter `/dashboard/teachers`.
- Wenn Lehrkraft-Anträge fehlen, nachdem Migrationen 001–006 bereits ausgeführt wurden, einmal `202611160007_repair_teacher_signup_requests.sql` einspielen. Sie stellt passende ausstehende Profile als Anträge wieder her.

Für alle Tests ausschließlich erfundene Daten nutzen. Öffentliche Rollen-/Schulwahl belegt keine tatsächliche Schulzugehörigkeit und ist ohne Einladungs- oder Verifizierungsverfahren nicht für den produktiven Schuleinsatz geeignet.

## Vercel-Deployment

Repository in Vercel importieren, Framework Next.js auswählen und `NEXT_PUBLIC_SUPABASE_URL` sowie `NEXT_PUBLIC_SUPABASE_ANON_KEY` als Environment Variables für Preview/Production setzen. Supabase Site URL und erlaubte Redirect URLs für die tatsächlichen Domains konfigurieren. Migrationen kontrolliert im passenden Supabase-Projekt ausführen.

## Projektstruktur

- `src/app`: öffentliche Seiten, Auth-Flows, Dashboards und Toilettenanfrage-API
- `src/components`: wiederverwendbare UI-Komponenten
- `src/lib/supabase`: SSR- und Browser-Clients
- `src/lib/validation.ts`: gemeinsame Validierung
- `supabase/migrations`: Schema, Trigger, Funktionen, Indizes und RLS
- `tests`: Vitest-Tests

## Noch erforderliche Produktarbeit

Einladungs-/Schulzugehörigkeits-Verifizierung, vollständige Schüler-/Lehrerverwaltung, Vertretungsplan, erweiterte Kalender-/Prüfungs-/Offlinefunktionen, Realtime-Benachrichtigungen und sichere Hardware-Geräte-API müssen vor Produktion weiter implementiert und getestet werden.

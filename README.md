# SchulWatch One

**Schule. Einfach. Digital.** – Next.js App Router, TypeScript, Tailwind CSS und Supabase.

> Sicherheitsorientierte Projektgrundlage. Diese erste Version enthält die öffentliche Website, Supabase-Auth-Grundlagen, einen geschützten rollenabhängigen Einstieg, das Datenbankschema mit RLS sowie Toilettenanfrage-Endpunkte. Sie ist ausdrücklich **noch kein vollständig produktionsfertiges Schulverwaltungssystem**: Stundenplan-, Nachrichten-, Geräte-, Support- und umfangreiche Verwaltungsoberflächen müssen noch ergänzt und geprüft werden. Keine echten Schülerdaten verwenden, bis Datenschutz, Verträge und Sicherheitsprüfung geklärt sind.

## Lokal starten

1. Node.js 20+ installieren und `npm install` ausführen.
2. Supabase-Projekt erstellen und in **SQL Editor** `supabase/migrations/202611160001_initial_schema.sql` ausführen.
3. `.env.example` nach `.env.local` kopieren und URL + Publishable/anon-Key aus Supabase eintragen. **Keinen Service-Role-Key im Browser oder Repository verwenden.**
4. In Supabase Auth die E-Mail-Bestätigung aktivieren. Site URL auf `http://localhost:3000` setzen und `/auth/callback` als Redirect URL erlauben.
5. `npm run dev` starten.

Schulregistrierungen werden als ausstehende Anträge angelegt. Eine Freischaltung durch einen verifizierten Plattformadministrator und der organisatorische Prüfprozess sind vor echtem Betrieb einzurichten. Das Projekt vergibt niemals Plattformadmin-Rechte bei öffentlicher Registrierung.

## Vercel-Deployment

Repository in Vercel importieren, Framework Next.js auswählen und `NEXT_PUBLIC_SUPABASE_URL` sowie `NEXT_PUBLIC_SUPABASE_ANON_KEY` als Environment Variables für Preview/Production setzen. Supabase Auth Site URL und Redirect URLs auf die tatsächliche Domain ergänzen. Migrationen kontrolliert auf das Supabase-Projekt anwenden. Vor Freigabe RLS mit getrennten Testkonten/Schulen prüfen, Rate Limiting konfigurieren und Datenschutz-/Aufbewahrungspflichten mit der Schule klären.

## Sichere Erstadministration

Der erste Plattformadministrator darf nicht über ein öffentliches Formular entstehen. Nach verifizierter Identitätsprüfung einen bestehenden Auth-Benutzer in einer kontrollierten SQL-/Admin-Prozedur auf `platform_admin` setzen. Diese Tätigkeit muss dokumentiert und auditiert werden; niemals einen Secret-Key in Clientcode einsetzen.

## Projektstruktur

- `src/app`: öffentliche Seiten, Auth-Callback, geschützter Einstieg und Toiletten-API
- `src/lib/supabase`: SSR- und Browser-Clients
- `src/lib/validation.ts`: gemeinsame serverseitig wiederverwendbare Validierung
- `supabase/migrations`: Schema, Trigger, Indizes und RLS
- `tests`: Validierungstests

## Noch erforderliche Produktarbeit

Schulfreigabe-Workflow inkl. Admin-Oberfläche, passwortbasierte Mitarbeitenden-/Schüler-Einladungen, Klassen-/Mitgliedschaftsverwaltung, Stundenpläne, Aufgaben, Nachrichten/Realtime-Benachrichtigungen, Schulmeldungen, Termine, Geräte-Provisionierung und -Tokenrotation, Datenlöschung/Retention-Job, Rate Limiting, E2E-/RLS-Integrationstests sowie unabhängige Sicherheits- und Datenschutzprüfung sind vor Produktivbetrieb umzusetzen. Toilettenanfragen ersetzen niemals dringende persönliche Kommunikation.

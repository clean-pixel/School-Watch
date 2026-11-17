# SchulWatch One – Bestandsaufnahme (Code-Audit)

**Prüfstand:** Git-Branch `copilot/schulwatch-one-foundation`, Commit `fdee6cb9729b96874206677b60e563f1b56a665e` und der hier dokumentierte Folge-Fix. Das ist eine statische Prüfung der erreichbaren Repository-Dateien; ich habe keinen Supabase-MCP-Zugriff auf ein Live-Projekt und kann weder dessen installierte Migrationen/RLS noch echte Anmeldung oder UI im Browser verifizieren. Es wurden in diesem Audit keine automatisierten Tests ausgeführt.

## Kurzurteil

Das Repository ist ein Next.js/Supabase-MVP, **keine produktionsfertige vollständige Schulplattform**. Es enthält echte Auth-, RLS- und einige CRUD-/Toilettenanfrage-Flows, jedoch fehlen mehrere im Master-Prompt geforderte Rollenbereiche und alle Features A–H weitgehend. Ein erfolgreicher Build, Live-Supabase-Test oder Vercel-Deploy wird hier nicht behauptet.

## Status je Bereich

| Bereich | Status | Evidenz / Befund |
|---|---|---|
| Öffentliche Startseite und responsives Navy/Türkis-Grunddesign | TEILWEISE FERTIG | `src/app/page.tsx`, `src/app/globals.css`; Kontakt ist nicht als funktionsfähiger Kontaktkanal belegt, Animationen/Icons/Premium-App-Verhalten sind nicht vollständig. |
| Impressum, Datenschutz, Nutzungsbedingungen | TEILWEISE FERTIG | Seitenverzeichnisse existieren; tatsächliche rechtliche Vollständigkeit wurde nicht validiert. |
| Login, Logout, Passwort vergessen/zurücksetzen | TEILWEISE FERTIG | `src/app/anmelden/page.tsx`, `src/app/auth/signout/route.ts`, Passwortseiten; reale Supabase-Mail-/Redirect-Konfiguration und End-to-End-Ablauf nicht getestet. |
| Schulregistrierung ohne Schul-Antrag | TEILWEISE FERTIG | Migration 005 legt Schule und `school_admin` direkt an; E-Mail-Bestätigung kann separat durch Supabase erforderlich bleiben. End-to-End in Live-Supabase nicht geprüft. |
| Schülerregistrierung mit Schulauswahl, sofort aktiv | TEILWEISE FERTIG | `src/app/registrieren/*`, Migration 005 und `available_schools()`; Klassenzuweisung und Schülerverwaltung fehlen. |
| Lehrkraftregistrierung mit Schulfreigabe | FEHLERHAFT / BEHOBEN IM CODE, DB-AKTUALISIERUNG OFFEN | Migration 005 erzeugt `teacher_join_requests`; `/dashboard/teachers` zeigt sie. Konten aus früherem, abweichendem DB-Trigger erhalten nicht automatisch einen Antrag. Migration 007 repariert bereits ausstehende Lehrerprofile, vertraut dabei ausdrücklich nicht mehr auf vom Nutzer veränderbare Auth-Metadaten. |
| Rollen-, Schul- und Datensatztrennung | TEILWEISE FERTIG | SQL 001–005 enthält RLS und rollenbezogene Prüfungen; konkrete Live-Policies, alle CRUD-Operationen und mandantenübergreifende Negativtests wurden nicht geprüft. Offene Selbstregistrierung mit frei wählbarer Schule beweist keine Zugehörigkeit. |
| Schulleitungs-Dashboard, Klassen und Lehrkraftwerkzeuge | TEILWEISE FERTIG | `src/app/dashboard/page.tsx`, `[section]/page.tsx`, `actions.ts`: Klassen, Stundenplan-Eintrag, Hausaufgaben, Nachrichten, Meldungen, Termine. Schüler-/Lehrerverwaltung, Einladung und zahlreiche Verwaltungsaktionen fehlen. |
| Schülerdashboard / Stundenplan / Aufgaben / Nachrichten / Termine | TEILWEISE FERTIG | Datenbankabfragen/Ansichten vorhanden, aber keine vollständige persönliche Dashboardlogik, Zuordnung/Abgabe-Workflows oder vollständige Widgets. |
| Vertretungsplan und Live-Alarm | FEHLT | Es gibt eine `substitutions`-Tabelle, aber keine vollständige Verwaltungs-, Zielgruppen-/Benachrichtigungs- und Live-Alarm-Implementierung belegt. |
| Geräteverwaltung / SchulWatch-Hardware-API | FEHLT | Schema enthält `devices`/`device_assignments`; keine sichere Geräte-Enrollment-, Token-, API- oder Firmware-Integration gefunden. Hardwarefähigkeiten sind nicht verifiziert. |
| PWA / Offline-Modus | FEHLT | Keine Service-Worker-/Offline-/Manifest-Implementierung im geprüften Quellcode gefunden. |
| Prüfungsplaner, Fokusmodus, Kalender, Dashboard-Widgets | FEHLT | Keine Implementierung der Features A–H im geprüften Quellcode. |
| Toilettenanfrage senden/entscheiden/Benachrichtigen | TEILWEISE FERTIG | `src/app/api/toilet-requests/*`, Komponente und SQL-Funktion/RLS: senden, Entscheidung, offene Anfrage eindeutig, Benachrichtigung in DB. Verlauf ist begrenzt; Zurückziehen fehlt; Polling/Benutzeroberfläche sowie RLS müssen live getestet werden. |
| Datenbank-Schema, Fremdschlüssel und RLS | TEILWEISE FERTIG | Migration 001–007 beschreibt Schema/FKs/Policies. Kein Live-Supabase-MCP-Zugriff in dieser Ausführung; tatsächliche Projektabweichungen sind unbekannt. |
| Eingabevalidierung | TEILWEISE FERTIG | `src/lib/validation.ts` und Zod in Server Actions; nicht jedes UI-/DB-Formular ist mit Ende-zu-Ende-Tests abgedeckt. |
| Umgebungsvariablen / Vercel | VORBEREITET | `.env.example` hat nur Supabase URL und anon/publishable Key; keine Produktions-URLs/Secrets. Deployment und Supabase Redirects sind nicht ausgeführt/verifiziert. |
| Tests | FEHLT ALS UMFASSENDE ABDECKUNG | `tests/validation.test.ts` ist eine kleine Vitest-Testsuite. Login, Registrierung, Rollen, RLS-Isolation, Toiletten, Kalender, Offline und Mobile sind nicht mit Integrationstests belegt. |

## Sicherheitsbefunde mit Priorität

1. **Schul- und Rollenwahl sind keine Identitätsprüfung.** Öffentliche Registrierung erlaubt Schulwahl; Freigabe schützt Lehrkraft-Funktionen, aber ein echter Betrieb braucht kontrollierte Einladung/Schulcode oder bestätigte Organisationszugehörigkeit.
2. **Nicht die Service-Role verwenden.** Die geprüften Supabase-Clients nutzen den öffentlichen anon/publishable-Key; das ist richtig. Dies ersetzt nicht RLS-Tests.
3. **RLS muss im tatsächlichen Supabase-Projekt verifiziert werden.** SQL-Dateien im Repo beweisen nicht, dass die Migrationen auf der konfigurierten Instanz ausgeführt wurden.
4. **Toilettenanfrage-Endpunkt braucht Integrationstest.** RLS soll Teilnehmer einschränken und der DB-Index begrenzt offene Anfragen; Zurückziehen und genaue Zuständigkeit/Schul-Isolation sind unvollständig.
5. **Reparatur vertraut nicht mehr Auth-Metadaten.** `raw_user_meta_data` ist nutzerveränderbar und darf nicht zur nachträglichen Rollenerhöhung dienen. Frühere Lehrer-Anmeldungen, die in `profiles` als Schüler gespeichert wurden, müssen nach Migration 005 sicher neu als Lehrkraft registriert oder manuell über einen verifizierten Admin-Prozess korrigiert werden.

## Umsetzung aus diesem Audit

- Migration `202611160007_repair_teacher_signup_requests.sql` wurde gehärtet: sie legt fehlende `teachers`-/Join-Request-Zeilen nur für Profile an, die in der Datenbank bereits `teacher`, `pending` und einer aktiven Schule zugeordnet sind. Sie befördert Schüler nicht anhand von Auth-Metadaten.
- `docs/teacher-registration-troubleshooting.md` erläutert die Reihenfolge und den Fall alter Registrierungen.
- Diese Audit-Datei macht sichtbar, was im Master-Prompt noch offen ist; sie behauptet nicht, A–H oder die Produktionsfreigabe umzusetzen.

## Nächste Schritte

1. Migrationen 001–006 müssen im richtigen Supabase-Projekt bereits erfolgreich ausgeführt sein; danach Migration 007 einmal über den Supabase SQL Editor einspielen.
2. Schulleitungskonto anmelden und `/dashboard/teachers` prüfen. Alte, als Schüler gespeicherte Lehrer-Konten nicht automatisch per Metadaten hochstufen.
3. Automatisierte Typecheck-/Build-/Vitest-Läufe lokal durchführen und Ergebnisse notieren; Integrationstests mit isolierter Test-Supabase ergänzen.
4. Vor Produktionsstart: Einladung/Verifizierung, tenant-isolierte RLS-Negativtests, Datenschutzprüfung, Geräte-API-Design und erforderliche Produktfeatures implementieren.

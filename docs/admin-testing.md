# SchoolWatch lokal testen: Registrierung und Admin-Freigabe

Die Registrierung und Schulfreigabe verwenden das konfigurierte Supabase-Projekt. Verwende zum Testen nur erfundene Schuldaten und keine echten Schüler- oder Personaldaten.

## Voraussetzungen

1. Die lokale `.env.local` enthält `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Publishable/anon key, niemals den `service_role`-Key).
2. Wende im Supabase SQL Editor die drei Dateien unter `supabase/migrations/` in aufsteigender Reihenfolge an. Falls die ersten beiden Migrationen bereits angewendet sind, führe nur `202611160003_reject_school_registration.sql` aus. Führe eine Migration nicht erneut aus, wenn sie bereits erfolgreich gelaufen ist.
3. Starte die lokale App mit `npm.cmd run dev` und öffne `http://localhost:3000/schule-registrieren`.

## Eigenes Konto als Plattform-Admin für einen privaten Test einrichten

1. Registriere zuerst dein eigenes Konto über `/schule-registrieren` und bestätige die Verifizierungs-E-Mail.
2. Öffne Supabase → SQL Editor und führe dieses Update mit **deiner eigenen Registrierungs-E-Mail** aus. Ersetze die Beispieladresse. Dadurch bekommt ausschließlich das dazugehörige Profil die Plattform-Admin-Rolle:

```sql
update public.profiles as p
set role = 'platform_admin'
from auth.users as u
where p.id = u.id
  and lower(u.email) = lower('DEINE-EIGENE-E-MAIL@example.com');
```

3. Melde dich auf der App ab und wieder mit diesem Konto an. Öffne `http://localhost:3000/admin`.
4. Registriere anschließend eine Testschule mit einer weiteren E-Mail-Adresse und bestätige deren E-Mail. Der Antrag sollte im Admin-Bereich erscheinen. Bestätigen oder ablehnen aktualisiert den Antrag über serverseitig autorisierte Supabase-Funktionen.

Die Admin-Seite prüft die Rolle auf dem Server; die Datenbankfunktionen prüfen sie zusätzlich. Gib die Plattform-Admin-Rolle nicht an öffentliche Testkonten weiter. Vor echtem Betrieb müssen Admin-Konten, Datenschutz, E-Mail-Flows und die Datenbankkonfiguration überprüft werden.

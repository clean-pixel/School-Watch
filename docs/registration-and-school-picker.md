# Anmeldung, Schulauswahl und direkter Einstieg

## Schulliste erscheint nicht

Die Registrierung lädt freigegebene Schulen über die PostgreSQL-Funktion `available_schools()`. Im Supabase SQL Editor müssen die Projektmigrationen in Reihenfolge ausgeführt sein. Wenn 001–008 schon aktiv sind, führe `202611160009_restore_school_picker.sql` aus und lade die Registrierungsseite neu. Die Migration ändert keine Tabellen und gibt nur Name/Stadt/ID freigegebener Schulen über die öffentliche Picker-Funktion zurück.

Die Registrierungsseite hat außerdem „Schulliste neu laden“. Wenn die Liste danach leer bleibt, prüfe, ob mindestens eine Schule mit `status = 'approved'` in genau dem Supabase-Projekt existiert, dessen URL in `.env.local` steht.

## Schulkonto sofort öffnen

Ein Supabase-Konto benötigt eine E-Mail-Adresse oder Telefonnummer als Login. Die App verwendet die E-Mail als Login und kann sie nicht sicher weglassen oder durch eine gemeinsame/fiktive Adresse ersetzen.

Ist E-Mail-Bestätigung in Supabase Auth ausgeschaltet, gibt `signUp` sofort eine Sitzung zurück; die Registrierungsseite leitet die Schulleitung direkt zu `/dashboard` weiter. Ist Bestätigung eingeschaltet, bleibt die Schule bereits angelegt, aber Supabase gibt zunächst keine Sitzung aus. Dann muss der Bestätigungslink angeklickt werden; `/auth/callback` tauscht ihn gegen eine Sitzung und leitet zum Dashboard. Für Tests kann man die Bestätigung in Supabase Auth deaktivieren. Für den Produktivbetrieb sollte die E-Mail-Adresse verifiziert bleiben.

Es gibt keinen Plattformfreigabe-Antrag für Schulregistrierungen. Nur Lehrkräfte benötigen Freigabe durch die Schulleitung.

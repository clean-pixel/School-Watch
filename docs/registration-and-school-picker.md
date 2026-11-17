# Anmeldung, Schulauswahl und direkter Einstieg

## Schulliste erscheint nicht

Die Registrierung lädt freigegebene Schulen über die PostgreSQL-Funktion `available_schools()`. Im Supabase SQL Editor müssen die Projektmigrationen in Reihenfolge ausgeführt sein. Wenn 001–008 schon aktiv sind, führe `202611160009_restore_school_picker.sql` aus und lade die Registrierungsseite neu. Die Migration ändert keine Tabellen und gibt nur Name/Stadt/ID freigegebener Schulen über die öffentliche Picker-Funktion zurück.

Die Registrierungsseite lädt die Schulliste dynamisch und hat außerdem „Schulliste neu laden“. Wenn die Liste danach leer bleibt, prüfe, ob mindestens eine Schule mit `status = 'approved'` in genau dem Supabase-Projekt existiert, dessen URL in `.env.local` steht.

## Direkte Schulanmeldung

Supabase braucht für den Login weiterhin eine E-Mail-Adresse oder Telefonnummer. Die App verwendet die E-Mail als Login. Eine Anmeldungssitzung entsteht nur, wenn Supabase Auth die Bestätigung tatsächlich deaktiviert hat und `signUp` eine Session zurückgibt. Die Seite behauptet keinen erfolgreichen Direktlogin, wenn Supabase keine Sitzung liefert.

Prüfe in **Supabase Dashboard → Authentication → Sign In / Providers → Email** die Einstellung **Confirm email** für dasselbe Projekt, dessen URL in `.env.local` steht. Bei aktivierter Bestätigung erzeugt Supabase keine Sitzung unmittelbar beim Signup; die Website kann dies nicht sicher umgehen. Wenn die Bestätigung ausgeschaltet ist, die App aber weiterhin keine Session erhält, prüfe Projekt-URL/anon-Key, starte `npm run dev` nach `.env.local`-Änderungen neu und lösche im Browser alte Site-Daten.

Bei erfolgreicher Sitzung leitet die App die Schulleitung direkt nach `/dashboard`. Bei aktivierter Bestätigung führt der E-Mail-Callback nach erfolgreicher Verifikation zum Dashboard.

Es gibt keinen Plattformfreigabe-Antrag für Schulregistrierungen. Nur Lehrkräfte benötigen Freigabe durch die Schulleitung.

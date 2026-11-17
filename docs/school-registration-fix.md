# SchoolWatch lokal aktualisieren und testen

Schulregistrierung erstellt einen Datensatz für die Schule, weist der registrierenden Person die Rolle `school_admin` (Schulleitung) zu und leitet sie nach erfolgreicher Anmeldung direkt zu `/dashboard`. Bei aktivierter E-Mail-Bestätigung erfolgt die Weiterleitung nach Klick auf den Bestätigungslink. Die Schulleitung sieht dort ihre Schule, Schul-ID und Links zu Stundenplan, Klassen und weiteren Bereichen.

Die Registrierungsauswahl für Schüler und Lehrkräfte lädt freigegebene Schulen über die Datenbankfunktion `available_schools()`. Wenn eine früher registrierte Schule fehlt, liegt das oft an den noch nicht angewendeten Supabase-Migrationen. Nach den bisherigen Migrationen `202611160001` bis `202611160005` jetzt einmal `202611160006_activate_existing_school_signups.sql` im SQL Editor des verwendeten Supabase-Projekts ausführen. Die Migration erstellt fehlende Schul-Datensätze aus alten Schul-Anträgen und ordnet sie dem ursprünglichen Schulkonto zu.

Nach Änderungen im Git-Branch den lokalen Server mit Strg+C stoppen und neu starten. Supabase-Variablen stehen in `.env.local`; `.env.example` enthält nur leere Platzhalter. Keine echten Schülerdaten für Tests nutzen.

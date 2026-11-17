# Lehrkraft-Anmeldungen werden nicht angezeigt?

Die Registrierung einer Schule ist sofort aktiv und erstellt **keinen Schul-Antrag**. Schülerkonten werden ebenfalls sofort der ausgewählten Schule zugeordnet. **Nur Lehrkräfte** erzeugen eine ausstehende Anfrage, die Schulleitung unter `/dashboard/teachers` bestätigen oder ablehnen kann.

Wenn die Liste leer ist, prüfe:

1. Ist das angemeldete Konto der Schulleitung der ausgewählten Schule zugeordnet?
2. Wurde der Lehrkraftzugang mit Rolle „Lehrkraft“ und der richtigen Schule registriert?
3. Wurden die Migrationen 001–006 im selben Supabase-Projekt wie `.env.local` ausgeführt? Tabelle und Trigger entstehen in Migration 005.
4. Führe danach einmal `202611160007_repair_teacher_signup_requests.sql` aus. Sie stellt Anträge für Profile wieder her, die in der Datenbank bereits als ausstehende Lehrkraft der Schule gespeichert sind.
5. Wurde das alte Konto in der Datenbank als Schüler erstellt, registriere es nach Migration 005 erneut mit einer anderen E-Mail-Adresse als Lehrkraft. Die Reparatur stuft bestehende Schülerkonten absichtlich nicht anhand von `raw_user_meta_data` hoch, weil diese Angaben vom Nutzer geändert werden können.
6. Lade `/dashboard/teachers` neu. Falls Supabase E-Mail-Bestätigung verlangt, muss die Lehrkraft zusätzlich den Bestätigungslink öffnen; das ist unabhängig von der Schulfreigabe.

Die Reparaturmigration löscht keine Nutzerdaten. Nutze keine echten Schülerdaten im Testbetrieb.

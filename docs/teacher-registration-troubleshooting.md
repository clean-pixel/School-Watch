# Lehrkraft-Anmeldungen werden nicht angezeigt?

Die Registrierung einer Schule ist sofort aktiv und erstellt **keinen Schul-Antrag**. Schülerkonten werden ebenfalls sofort der ausgewählten Schule zugeordnet. **Nur Lehrkräfte** erzeugen eine ausstehende Anfrage, die Schulleitung unter `/dashboard/teachers` bestätigen oder ablehnen kann.

Wenn die Liste leer ist, prüfe:

1. Ist das angemeldete Konto der Schulleitung der ausgewählten Schule zugeordnet?
2. Wurde der Lehrkraftzugang mit Rolle „Lehrkraft“ und der richtigen Schule registriert?
3. Wurden die Migrationen 001–006 im selben Supabase-Projekt wie `.env.local` ausgeführt? Die Tabelle `teacher_join_requests` und der Trigger entstehen in Migration 005.
4. Wenn Lehrkräfte vor Migration 005 erstellt wurden oder damalige Migrationen teilweise fehlten, führe nach 001–006 einmal `202611160007_repair_teacher_signup_requests.sql` aus. Sie stellt offene Anfragen aus vorhandenen Auth-Metadaten/Profilen wieder her.
5. Lade `/dashboard/teachers` nach dem SQL-Update neu. Wenn Supabase Auth E-Mail-Bestätigung verlangt, muss die Lehrkraft den E-Mail-Link ebenfalls öffnen; das ist unabhängig von der Schulfreigabe.

Die Migration löscht keine Nutzerdaten. Sie betrifft nur ausstehende Konten mit Rolle Lehrkraft und gültiger Schulzuordnung. Nutze keine echten Schülerdaten im Testbetrieb.

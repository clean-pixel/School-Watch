# SchulWatch One – lokales Testsetup

## Registrierungen und Freigabe

- **Schule:** Konto und eigene freigeschaltete Schule werden sofort angelegt; es gibt keinen Schul-Registrierungsantrag.
- **Schüler/in:** wählt eine vorhandene Schule aus und wird sofort dieser Schule zugeordnet.
- **Lehrkraft:** wählt eine Schule aus. Das Konto bleibt bis zur ausdrücklichen Bestätigung durch deren Schuladministrator gesperrt.
- Supabase kann unabhängig davon weiterhin eine E-Mail-Bestätigung verlangen.

## Datenbank einrichten

Im Supabase SQL Editor die Projektmigrationen in Reihenfolge ausführen. Wenn die bisherigen Migrationen `202611160001` bis `202611160004` bereits ausgeführt wurden, führe `202611160005_school_picker_and_teacher_tools.sql` aus. Eine Migration, die schon erfolgreich ausgeführt wurde, nicht erneut ausführen.

Dann lokal `/registrieren` öffnen. Registriere zunächst eine Testschule, danach kann diese von Schülern und Lehrkräften ausgewählt werden. Im Konto der Schule können offene Lehrkraft-Anmeldungen unter `/dashboard/teachers` bestätigt oder abgelehnt werden.

Der Lehrkraftbereich hat Formulare für Klassen, Stundenplan, Hausaufgaben, Nachrichten, Schulmeldungen und Termine. Nutze ausschließlich erfundene Testdaten.

## Einschränkung für Tests

Eine öffentliche Schul-/Rollenwahl beweist nicht, dass die Person wirklich zur Schule gehört. Lehrer-Freigabe in der Schule verhindert Nutzung vor Freigabe, aber Schülerregistrierung ist absichtlich sofort aktiv. Daher ist das Setup nur für eine private Testinstanz und keine echten Schülerdaten gedacht. Für öffentlichen Betrieb sind verifizierte Einladungen/Schulcodes und Datenschutzprüfung erforderlich.

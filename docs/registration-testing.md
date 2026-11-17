# Testmodus: Selbstregistrierung

Die App bietet `/registrieren` mit Rollenwahl für Schüler/in, Lehrkraft und Schule. Schüler- und Lehrkraftkonten sind nach der Anmeldung zunächst **keiner Schule zugeordnet**. Sie können daher noch keine schulbezogenen Daten sehen oder verwalten. Eine Schulzuordnung sollte später nur über einen geprüften Einladungscode oder einen Administrator erfolgen.

Die Migration `202611160004_self_service_registration_test_mode.sql` aktiviert sofortige Schulfreigabe: jede Person, die das öffentliche Schulformular ausfüllt, erhält automatisch ein freigegebenes Schulkonto. **Nur für ein privates Testprojekt mit erfundenen Daten anwenden.** Nicht auf einer öffentlich erreichbaren Produktivinstanz verwenden; dort könnten Fremde beliebige Schulen anlegen.

Im Supabase SQL Editor die Migrationen in der vorgesehenen Reihenfolge ausführen. Wenn die ersten drei Migrationen bereits angewendet sind, führe nur Migration `202611160004_self_service_registration_test_mode.sql` aus. Bei aktivierter E-Mail-Bestätigung in Supabase muss die Person weiterhin den Bestätigungslink anklicken; die Migration überspringt nur die manuelle Admin-Freigabe der Schule, nicht die E-Mail-Verifizierung.

Dann lokal `/registrieren` öffnen. Das Anmeldeformular verlinkt direkt zu allen drei Kontoarten. Benutze beim Testen keine echten Schülerdaten.

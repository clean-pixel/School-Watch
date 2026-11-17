import Link from "next/link";

export default function Page() {
  return (
    <main className="container" style={{ padding: "40px 0 80px" }}>
      <header className="topbar">
        <Link className="brand" href="/"><span className="brand-mark">S</span> SchulWatch One</Link>
        <nav className="navlinks">
          <Link href="/">Startseite</Link>
          <Link href="/kontakt">Kontakt</Link>
          <Link href="/anmelden">Anmelden</Link>
        </nav>
      </header>
      <section className="formwrap">
        <div className="eyebrow">Datenschutz</div>
        <h1 style={{ fontSize: "2.3rem" }}>Datenschutzhinweise</h1>
        <p>Eine vollständige Datenschutzhinweise- und Informationspflicht muss durch den tatsächlichen Betreiber gesetzt werden, bevor echte Nutzer- und Schülerdaten verarbeitet werden. Die vorliegende Seite dient als sicherer Platzhalter mit klarer Kennzeichnung.</p>
        <div className="card">
          <p><strong>Verantwortlicher:</strong> Noch nicht benannt</p>
          <p><strong>Datenschutzkontakt:</strong> Noch nicht hinterlegt</p>
          <p><strong>Zwecke:</strong> Schulverwaltung, Authentifizierung, Kommunikation, Berechtigungsverwaltung</p>
          <p><strong>Rechtsgrundlagen:</strong> Nach rechtlicher Prüfung und Schulvereinbarung ergänzen</p>
          <p><strong>Speicherfristen:</strong> Nach Schul- und Datenschutzrichtlinien bestimmen</p>
        </div>
      </section>
    </main>
  );
}

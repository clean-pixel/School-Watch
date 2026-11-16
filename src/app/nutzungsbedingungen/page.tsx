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
        <div className="eyebrow">Nutzungsbedingungen</div>
        <h1 style={{ fontSize: "2.3rem" }}>Allgemeine Nutzungsbedingungen</h1>
        <p>Die Verwendung von SchulWatch One unterliegt einer rechtlich verbindlichen Benutzungsvereinbarung, die der tatsächliche Betreiber vor dem produktiven Betrieb mit den beteiligten Schulen und Nutzergruppen prüfen muss.</p>
        <div className="card">
          <p>Diese Vorlage dient nur als Sicherheitsplatzhalter und ist kein rechtsgültiger Vertrag.</p>
          <p>Vor Produktivbetrieb müssen:</p>
          <ul>
            <li>Nutzungsrechte und Verhaltensregeln festgelegt werden</li>
            <li>Datenschutz- und Haftungsfragen geklärt sein</li>
            <li>Verantwortlichkeiten zwischen Schule und Betreiber definiert sein</li>
          </ul>
        </div>
      </section>
    </main>
  );
}

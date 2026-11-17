import Link from "next/link";

const features = [
  ["Ein klarer Überblick", "Stundenplan, Meldungen und wichtige Informationen an einem Ort – passend für den Schulalltag."],
  ["Rollen mit Verantwortung", "Getrennte Zugänge für Schulen, Lehrkräfte und Schüler. Zugriff wird serverseitig und über Datenbankregeln geschützt."],
  ["Bereit für SchulWatch", "Die Plattform ist für eine spätere individuelle Geräteanbindung vorbereitet. Geräte erhalten keine gemeinsamen Zugangsschlüssel."],
];

export default function Home() {
  return <main className="container">
    <header className="topbar">
      <Link className="brand" href="/"><span className="brand-mark">S</span> SchulWatch One</Link>
      <nav className="navlinks"><a className="wide" href="#funktionen">Funktionen</a><a href="#kontakt">Kontakt</a><Link href="/registrieren?rolle=schule">Schule registrieren</Link><Link href="/anmelden">Anmelden</Link></nav>
    </header>
    <section className="hero">
      <div><div className="eyebrow">Schule. Einfach. Digital.</div><h1>Der Schultag.<br /><span style={{ color: "var(--teal)" }}>Einfacher organisiert.</span></h1><p>SchulWatch One bringt Stundenplan, Schulmeldungen, Verwaltung und Kommunikation an einem Ort – klar, sicher und für den Schulalltag vorbereitet.</p><div className="actions"><Link className="button" href="/registrieren?rolle=schule">Schule registrieren</Link><Link className="button secondary" href="/registrieren?rolle=schueler">Als Schüler/in registrieren</Link></div></div>
      <div className="preview"><div className="preview-head"><span>Heute</span><span>SchulWatch</span></div><div className="clock">Schule. Einfach. Digital.</div><div className="row"><span><span className="dot" /> Stundenplan</span><strong>Alles im Blick</strong></div><div className="row"><span><span className="dot" /> Nachrichten</span><strong>Direkt verbunden</strong></div><div className="row"><span><span className="dot" /> Schulmeldungen</span><strong>Aktuell informiert</strong></div></div>
    </section>
    <section className="section" id="funktionen"><div className="eyebrow">Eine Plattform, viele Perspektiven</div><h2>Weniger Suchen. Mehr Überblick.</h2><div className="grid">{features.map(([title, body]) => <article className="card" key={title}><h3>{title}</h3><p>{body}</p></article>)}</div></section>
    <section className="section" id="schulen"><div className="card"><div className="eyebrow">Für Schulen</div><h2>Schulorganisation beginnt mit sicheren Grundlagen.</h2><p>Die Schulleitung kann nach der Registrierung direkt Klassen, Stundenpläne und Schulbereiche einrichten. Lehrkräfte werden durch die Schulleitung bestätigt.</p><div className="actions"><Link className="button" href="/registrieren?rolle=schule">Schulregistrierung starten</Link><Link className="button secondary" href="/anmelden">Zur Anmeldung</Link></div></div></section>
    <section className="section" id="kontakt"><h2>Kontakt</h2><article className="card"><p>Fragen zur Testversion? Kontaktiere das SchulWatch-One-Team über den Projektverantwortlichen. Ein öffentliches Kontaktformular ist derzeit nicht eingerichtet.</p></article></section>
    <section className="section"><h2>Häufige Fragen</h2><div className="grid"><article className="card"><h3>Ist die Plattform schon produktionsbereit?</h3><p>Nein. Dies ist ein sicherheitsorientierter MVP-Stand für lokale Tests und Vorschau.</p></article><article className="card"><h3>Kann man selbst testen?</h3><p>Ja. Nutze erfundene Testdaten und ein eingerichtetes Supabase-Projekt.</p></article><article className="card"><h3>Was ist bei echtem Betrieb wichtig?</h3><p>Schulzugehörigkeit, Admin-Rechte, Datenschutz und Supabase-RLS müssen vor dem Produktiveinsatz geprüft werden.</p></article></div></section>
    <footer><span>© {new Date().getFullYear()} SchulWatch One · Schule. Einfach. Digital.</span><span><Link href="/datenschutz">Datenschutz</Link> · <Link href="/impressum">Impressum</Link> · <Link href="/nutzungsbedingungen">Nutzungsbedingungen</Link></span></footer>
  </main>;
}

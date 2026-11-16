export default function Home() {
  return (
    <main className="container">
      <header className="topbar">
        <a className="brand" href="/"><span className="brand-mark">S</span> SchulWatch One</a>
        <nav className="navlinks">
          <a href="#funktionen">Funktionen</a>
          <a href="#schulen">Für Schulen</a>
          <a href="/registrieren?rolle=schule">Schule registrieren</a>
          <a href="/anmelden">Anmelden</a>
        </nav>
      </header>

      <section className="hero">
        <div>
          <div className="eyebrow">Schule. Einfach. Digital.</div>
          <h1>Der Schultag.<br /><span style={{ color: "var(--teal)" }}>Einfacher organisiert.</span></h1>
          <p>SchulWatch One bringt Stundenplan, Schulmeldungen, Verwaltung und Kommunikation an einem Ort – klar, sicher und für Schulalltag vorbereitet.</p>
          <div className="actions">
            <a className="button" href="/registrieren?rolle=schule">Schule registrieren</a>
            <a className="button secondary" href="/registrieren?rolle=schueler">Als Schüler registrieren</a>
          </div>
        </div>
        <div className="preview">
          <div className="preview-head">
            <span>Heute</span>
            <span>SchulWatch</span>
          </div>
          <div className="clock">08:30</div>
          <div className="row"><span><span className="dot" /> Deutsch</span><strong>Klasse 8b</strong></div>
          <div className="row"><span><span className="dot" /> Mathe</span><strong>Klasse 9a</strong></div>
          <div className="row"><span><span className="dot" /> Schulmeldung</span><strong>1 neue Mitteilung</strong></div>
        </div>
      </section>

      <section className="section" id="funktionen">
        <div className="eyebrow">Eine Plattform, viele Perspektiven</div>
        <h2>Weniger Suchen. Mehr Überblick.</h2>
        <div className="grid">
          <article className="card">
            <h3>Ein klarer Überblick</h3>
            <p>Stundenplan, Nachrichten und Mitschriften in einer übersichtlichen Oberfläche.</p>
          </article>
          <article className="card">
            <h3>Rollen mit Verantwortung</h3>
            <p>Schulen, Lehrkräfte und Schüler arbeiten mit unterschiedlichen Sichtweisen und Zugängen.</p>
          </article>
          <article className="card">
            <h3>Bereit für SchulWatch</h3>
            <p>Die Architektur ist so gebaut, dass spätere Geräte- und Schul-Integrationen einfacher werden.</p>
          </article>
        </div>
      </section>

      <section className="section" id="schulen">
        <div className="card">
          <div className="eyebrow">Für Schulen</div>
          <h2>Schulorganisation beginnt mit sicheren Grundlagen.</h2>
          <p>Registrierungen können als Testlauf schnell über ein Schulformular ausgelöst werden – für echte Nutzung in der Schule müssen Pflege, Autorisierung und Datenschutz noch final geprüft werden.</p>
          <div className="actions">
            <a className="button" href="/registrieren?rolle=schule">Schulregistrierung starten</a>
            <a className="button secondary" href="/anmelden">Zur Anmeldung</a>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>Häufige Fragen</h2>
        <div className="grid">
          <article className="card">
            <h3>Ist die Plattform schon produktionsbereit?</h3>
            <p>Nein. Diese Version ist ein sicherheitsorientierter Test- und MVP-Stand für lokale Tests und Vorschau.</p>
          </article>
          <article className="card">
            <h3>Kann man selbst testen?</h3>
            <p>Ja. Du kannst Schul-, Lehrer- und Schülerkonten im lokalen Testlauf anlegen und die Rollen ausprobieren.</p>
          </article>
          <article className="card">
            <h3>Was ist bei echtem Betrieb wichtig?</h3>
            <p>Schul- und Datenschutz, Admin-Rechte, E-Mail-Verifizierung und geeignete Supabase-Policies müssen final geprüft werden.</p>
          </article>
        </div>
      </section>

      <footer>
        <span>© {new Date().getFullYear()} SchulWatch One · Schule. Einfach. Digital.</span>
        <span><a href="/datenschutz">Datenschutz</a> · <a href="/impressum">Impressum</a> · <a href="/nutzungsbedingungen">Nutzungsbedingungen</a></span>
      </footer>
    </main>
  );
}

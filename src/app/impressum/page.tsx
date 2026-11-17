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
        <div className="eyebrow">Impressum</div>
        <h1 style={{ fontSize: "2.3rem" }}>Pflichtangaben</h1>
        <p>Vor produktiver Nutzung muss das vollständige Impressum durch den tatsächlichen Betreiber der Plattform ergänzt und rechtlich geprüft werden. Die Angaben hier sind bewusst als Einrichtungspunkt gestaltet und nicht als echte Unternehmensdaten zu verstehen.</p>
        <div className="card">
          <p><strong>Betreiber:</strong> Noch nicht bestimmt</p>
          <p><strong>Kontakt:</strong> Noch nicht hinterlegt</p>
          <p><strong>Adresse:</strong> Noch nicht festgelegt</p>
          <p><strong>Register:</strong> Nach gesetzlicher Anforderung ergänzen</p>
        </div>
      </section>
    </main>
  );
}

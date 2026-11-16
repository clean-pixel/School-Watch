import Link from "next/link";

export default function ErrorPage() {
  return (
    <main className="container" style={{ padding: "80px 0" }}>
      <div className="card">
        <div className="eyebrow">Fehler</div>
        <h1 style={{ fontSize: "2.4rem" }}>Ein Fehler ist aufgetreten</h1>
        <p>Bitte prüfe deine Verbindung und lade die Seite erneut. Wenn das Problem weiter besteht, wende dich an die Schul-IT oder den Support.</p>
        <Link className="button" href="/">Zur Startseite</Link>
      </div>
    </main>
  );
}

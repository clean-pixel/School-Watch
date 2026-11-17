import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container" style={{ padding: "80px 0" }}>
      <div className="card">
        <div className="eyebrow">404</div>
        <h1 style={{ fontSize: "2.4rem" }}>Seite nicht gefunden</h1>
        <p>Die gewünschte Seite existiert nicht oder wurde noch nicht bereitgestellt.</p>
        <Link className="button" href="/">Zur Startseite</Link>
      </div>
    </main>
  );
}

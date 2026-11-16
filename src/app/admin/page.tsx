import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { reviewSchoolRegistration } from "./actions";

type AdminPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "platform_admin") redirect("/dashboard");

  const [{ data: requests, error }, query] = await Promise.all([
    supabase
      .from("school_registration_requests")
      .select("id,school_name,school_type,street,postal_code,city,state,contact_name,email,created_at")
      .eq("state", "pending")
      .order("created_at", { ascending: true }),
    searchParams,
  ]);

  return (
    <main className="container" style={{ padding: "32px 0 80px" }}>
      <header className="topbar">
        <Link className="brand" href="/"><span className="brand-mark">S</span> SchulWatch One</Link>
        <nav className="navlinks"><Link href="/dashboard">Dashboard</Link><form action="/auth/signout" method="post"><button className="button secondary">Abmelden</button></form></nav>
      </header>
      <div className="eyebrow">Geschützter Bereich</div>
      <h1 style={{ fontSize: "2.6rem" }}>Plattform-Admin</h1>
      <p>Hier kannst du Schulregistrierungen prüfen und für deinen Test freigeben oder ablehnen.</p>

      {query.success === "approve" && <div className="notice" role="status">Die Schule wurde freigegeben.</div>}
      {query.success === "reject" && <div className="notice" role="status">Der Antrag wurde abgelehnt.</div>}
      {query.error && <div className="notice" role="alert">Die Aktion konnte nicht ausgeführt werden. Prüfe, ob die Datenbank-Migrationen angewendet wurden, und lade die Seite neu.</div>}
      {error && <div className="notice" role="alert">Anträge konnten nicht geladen werden. Prüfe, ob die Supabase-Migrationen angewendet wurden.</div>}

      {!error && requests?.length === 0 && <section className="card"><h2>Keine offenen Anträge</h2><p>Neue Schulregistrierungen erscheinen hier, sobald eine Person das Registrierungsformular abgeschickt und die E-Mail bestätigt hat.</p></section>}
      <section className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
        {requests?.map((request) => (
          <article className="card" key={request.id}>
            <div className="eyebrow">Offener Antrag</div>
            <h2 style={{ fontSize: "1.5rem" }}>{request.school_name}</h2>
            <p><strong>Schulart:</strong> {request.school_type}</p>
            <p><strong>Adresse:</strong> {request.street}, {request.postal_code} {request.city}, {request.state}</p>
            <p><strong>Kontakt:</strong> {request.contact_name}<br /><a href={`mailto:${request.email}`}>{request.email}</a></p>
            <p><strong>Eingegangen:</strong> {new Date(request.created_at).toLocaleString("de-DE")}</p>
            <div className="actions">
              <form action={reviewSchoolRegistration}>
                <input type="hidden" name="requestId" value={request.id} />
                <button className="button" name="decision" value="approve">Schule bestätigen</button>
              </form>
              <form action={reviewSchoolRegistration}>
                <input type="hidden" name="requestId" value={request.id} />
                <button className="button secondary" name="decision" value="reject">Ablehnen</button>
              </form>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

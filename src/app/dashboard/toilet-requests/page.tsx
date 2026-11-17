import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ToiletDecision } from "@/components/toilet-request-panel";
export default async function ToiletRequestsPage() {
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect("/anmelden");
 const {data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
 if(!profile || !["teacher","school_admin","student"].includes(profile.role)) return <main className="container"><p>Du hast keine Berechtigung für diesen Bereich.</p><Link href="/dashboard">Zur Übersicht</Link></main>;
 const {data,error}=await supabase.from("toilet_requests").select("id,status,created_at,student_id,teacher_id,class_id").order("created_at",{ascending:false}).limit(50);
 const visible=(data??[]).filter(r=>profile.role==="student"?r.student_id===user.id:r.teacher_id===user.id||profile.role==="school_admin");
 const studentIds=[...new Set(visible.map(r=>r.student_id))]; const {data:students}=studentIds.length?await supabase.from("profiles").select("id,display_name").in("id",studentIds):{data:[] as {id:string;display_name:string|null}[]};
 return <main className="container"><header className="topbar"><Link className="brand" href="/dashboard"><span className="brand-mark">S</span> SchulWatch One</Link></header><div className="eyebrow">Geschützter Bereich</div><h1 style={{fontSize:"2.7rem"}}>Toilettenanfragen</h1><p>Nur für dich freigegebene Anfragen werden angezeigt. Eine digitale Anfrage ersetzt keine dringende persönliche Kommunikation.</p>{error&&<div className="notice">Anfragen konnten nicht geladen werden.</div>}{visible.length?visible.map(r=><article className="card" key={r.id}><h3>{students?.find(s=>s.id===r.student_id)?.display_name??(profile.role==="student"?"Deine Anfrage":"Schüler/in")}</h3><p>{new Date(r.created_at).toLocaleString("de-DE")} · {r.status==="pending"?"Wartet auf Antwort":r.status==="approved"?"Erlaubt":r.status==="denied"?"Abgelehnt":"Zurückgezogen"}</p>{r.status==="pending"&&profile.role!=="student"&&<ToiletDecision id={r.id}/>}</article>):<div className="card"><p>Keine sichtbaren Anfragen vorhanden.</p></div>}<p><Link href="/dashboard">Zurück zum Dashboard</Link></p></main>;
}

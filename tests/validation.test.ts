import { describe, expect, it } from "vitest";
import { schoolRegistrationSchema, toiletDecisionSchema } from "../src/lib/validation";
describe("serverseitige Validierung",()=>{
 it("akzeptiert einen vollständig ausgefüllten Schul-Antrag",()=>{expect(schoolRegistrationSchema.safeParse({schoolName:"Beispielschule",schoolType:"Gesamtschule",street:"Schulweg 1",postalCode:"12345",city:"Berlin",state:"Berlin",contactName:"Max Mustermann",email:"schule@example.org",password:"sehr-sicheres-passwort",terms:"on",privacy:"on"}).success).toBe(true)});
 it("weist kurze Passwörter und ungültige Postleitzahlen ab",()=>{expect(schoolRegistrationSchema.safeParse({schoolName:"X",schoolType:"Schule",street:"Weg",postalCode:"123",city:"Berlin",state:"Berlin",contactName:"Max",email:"a@b.de",password:"kurz",terms:"on",privacy:"on"}).success).toBe(false)});
 it("akzeptiert nur UUID und erlaubte Entscheidung",()=>{expect(toiletDecisionSchema.safeParse({requestId:"00000000-0000-4000-8000-000000000001",decision:"approved"}).success).toBe(true);expect(toiletDecisionSchema.safeParse({requestId:"x",decision:"allow"}).success).toBe(false)});
});

/**
 * Sample 3 — Semantic "find in document" that knows when there's no answer.
 *
 * Shows: a Choice whose options are line IDs ("pick an option" becomes "point at a
 * line"), plus a Noul in the same request that checks whether ANY line answers.
 * Choice probabilities always sum to 1, so the Noul is what catches "not in here".
 * Jev selects; it never generates. Code quotes the original line verbatim.
 */
import { choice, noul } from "@typesafe-ai/sdk";
import { bar, dim, heading, makeClient } from "../lib/shared.js";

const client = makeClient();

const LEASE = `Residential Lease Agreement
The tenant shall pay rent of $1,850 on the first day of each month.
Rent paid after the fifth day of the month incurs a late fee of $75.
A security deposit equal to one month's rent is due at signing.
The deposit will be returned within 21 days after move-out, less any deductions for damage.
Tenant may not sublet the unit without prior written consent of the landlord.
Small pets under 25 lbs are permitted with an additional $300 pet deposit.
Dogs of any size must be leashed in common areas.
The landlord is responsible for repairs to plumbing, heating, and electrical systems.
Tenant is responsible for replacing light bulbs and smoke detector batteries.
Either party may terminate this lease with 60 days' written notice.
Quiet hours are from 10 p.m. to 7 a.m. daily.
Parking is limited to one assigned space per unit.`.split("\n");

const lineId = (i: number) => `L${String(i).padStart(2, "0")}`;
const document = LEASE.map((line, i) => `${lineId(i)}| ${line}`).join("\n");
const lineOptions = Object.fromEntries(LEASE.map((_, i) => [lineId(i), null]));

const queries = [
  "Can I keep my cat?",
  "What happens if I pay rent a week late?",
  "Who fixes a broken water heater?",
  "How much notice do I need to give before moving out?",
  "Is there a gym in the building?", // not in the lease
  "Can I put my friend on the lease while I travel?", // indirect: subletting
];

for (const query of queries) {
  // The state (the document) is identical across queries; only the questions change.
  const { answers } = await client.systemOne({
    state: document,
    questions: {
      where: choice(`Which line of the document best answers: "${query}"?`, lineOptions),
      exists: noul(`Does any line of the document address or answer: "${query}"?`, {
        true: "At least one line states or directly implies the answer",
        false: "No line of the document addresses this",
      }),
    },
  });

  heading(`Q: ${query}`);
  console.log(`  answer exists ${bar(answers.exists.noul)}`);
  if (answers.exists.noul < 0.3) {
    console.log("  ⇒ The lease doesn't say.");
    continue;
  }
  const top = Object.entries(answers.where.probabilities)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .filter(([, p]) => p >= 0.05);
  for (const [id, p] of top) {
    console.log(`  ${id} ${bar(p, 12)}  ${LEASE[Number(id.slice(1))]}`);
  }
  if (answers.exists.noul < 0.7) console.log(dim("  (partial or uncertain match, show with a caveat)"));
}

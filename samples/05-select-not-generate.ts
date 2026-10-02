/**
 * Sample 5 — Extraction by selection: regex finds candidates, Jev picks the right one.
 *
 * Shows: Jev doesn't generate text, so it can't hallucinate a value. Code finds every
 * candidate span; a Choice selects which one means what; code copies it verbatim and
 * does the arithmetic. A "not_present" option and confidence route doubtful fields to review.
 */
import { choice } from "@typesafe-ai/sdk";
import { dim, heading, makeClient } from "../lib/shared.js";

const client = makeClient();

const emails = [
  `Hi team — invoice #4471 for September is attached. Subtotal $12,400.00, plus a one-time
setup fee of $350.00, less your loyalty discount of $620.00. Total due: $12,130.00 by Oct 30.
Last month's invoice ($11,980.00) was paid in full, thanks! Questions go to billing@acme-supply.com,
not to me (jordan@acme-supply.com) as I'm out next week.`,
  `Following up on our call. We can do the pilot for $8,000, and if you sign for the full year it's
$84,000 instead of the $96,000 list price. Please send the signed order to contracts@vendorco.io.`,
  `Hey! Just confirming lunch Thursday. My new number is (415) 555-0199 if you need it.`,
];

const MONEY = /\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

/** Tag each regex match with an ID in the text so Jev can point at it in context. */
function tagCandidates(text: string, pattern: RegExp, prefix: string) {
  const values: string[] = [];
  const tagged = text.replace(pattern, (m) => `[${prefix}${values.push(m)}: ${m}]`);
  const options: Record<string, string | null> = Object.fromEntries(
    values.map((v, i) => [`${prefix}${i + 1}`, null]),
  );
  options.not_present = "None of the marked values is the one asked for";
  return { tagged, values, options };
}

const parseMoney = (s: string) => Number(s.replace(/[$,]/g, ""));

for (const email of emails) {
  let tagged = email;
  const money = tagCandidates(tagged, MONEY, "A");
  tagged = money.tagged;
  const addr = tagCandidates(tagged, EMAIL, "E");
  tagged = addr.tagged;

  const { answers } = await client.systemOne({
    state: { email: tagged },
    questions: {
      amount_due: choice("Which marked amount in `email` is the amount the reader currently owes or is being asked to pay?", money.options),
      discount: choice("Which marked amount in `email` is a discount or reduction?", money.options),
      reply_to: choice("Which marked email address in `email` should questions or documents be sent to?", addr.options),
    },
  });

  heading(email.split("\n")[0]!.slice(0, 80) + "…");
  console.log(dim(`  candidates: ${money.values.join(", ") || "—"} | ${addr.values.join(", ") || "—"}`));

  const pick = (a: { choice: string; confidence: number }, values: string[], prefix: string) => {
    if (a.choice === "not_present") return { value: undefined, note: "not present" };
    const value = values[Number(a.choice.slice(prefix.length)) - 1];
    return { value, note: a.confidence < 0.7 ? `⚠ review (conf ${a.confidence.toFixed(2)})` : `conf ${a.confidence.toFixed(2)}` };
  };

  const due = pick(answers.amount_due, money.values, "A");
  const disc = pick(answers.discount, money.values, "A");
  const reply = pick(answers.reply_to, addr.values, "E");
  console.log(`  amount_due  ${(due.value ?? "—").padEnd(28)} ${dim(due.note)}`);
  console.log(`  discount    ${(disc.value ?? "—").padEnd(28)} ${dim(disc.note)}`);
  console.log(`  reply_to    ${(reply.value ?? "—").padEnd(28)} ${dim(reply.note)}`);

  // Arithmetic stays in code, on verbatim values.
  if (due.value) console.log(`  ⇒ schedule payment of ${parseMoney(due.value).toLocaleString("en-US", { style: "currency", currency: "USD" })}`);
}

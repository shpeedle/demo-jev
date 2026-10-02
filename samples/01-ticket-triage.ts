/**
 * Sample 1 — Support ticket triage with speculative fan-out.
 *
 * Shows: all three primitives (Choice, Score, Noul) asked together in ONE request,
 * including speculative questions that only matter for some tickets. Code decides
 * which answers to use, and confidence decides whether to act automatically.
 */
import { choice, noul, score } from "@typesafe-ai/sdk";
import { bar, dim, heading, makeClient, printDistribution } from "../lib/shared.js";

const client = makeClient();

const tickets = [
  "Hi, I've been trying to connect my Stripe account for 3 days and the integration keeps failing. I'm losing sales. Please help ASAP.",
  "I was charged twice for my March invoice. Can you refund the duplicate? Thanks!",
  "This is the third time I'm writing. Your app deleted all my project files after the update and NOBODY has answered. Absolutely unacceptable.",
  "Do you offer a discount for nonprofits? We're a team of about 40.",
  "Hey, quick one, how do I change the email on my account and also why did my bill go up this month?",
];

const questions = {
  department: choice("Which team should handle `ticket`?", {
    billing: "Charges, refunds, invoices, subscription changes",
    technical: "Bugs, outages, integrations, data loss, how-to questions about the product",
    sales: "Pricing, plans, discounts, new purchases",
    account: "Login, email, profile, or account settings changes",
  }),
  frustration: score("How frustrated does the customer appear in `ticket`?", [
    "Calm, just stating facts",
    "Mildly inconvenienced but friendly",
    "Frustrated but civil",
    "Very angry, strong language or capitals",
  ]),
  urgent: noul("Does `ticket` convey urgency or time pressure?"),
  // Speculative: only meaningful for technical tickets, but nearly free to ask.
  severity: score("If `ticket` reports a product problem, how severe is the impact on the customer's business?", [
    "No product problem reported",
    "Cosmetic or minor inconvenience",
    "A feature is broken but there is a workaround",
    "Business is blocked, or data has been lost",
  ]),
  // Speculative: only meaningful for billing tickets.
  refund_requested: noul("Does `ticket` explicitly ask for money to be refunded?"),
  multiple_issues: noul("Does `ticket` raise two or more unrelated issues?"),
};

for (const ticket of tickets) {
  const { answers, usage } = await client.systemOne({ state: { ticket }, questions });
  const { department, frustration, urgent, severity, refund_requested, multiple_issues } = answers;

  heading(`“${ticket.slice(0, 90)}${ticket.length > 90 ? "…" : ""}”`);
  console.log(`  department → ${department.choice}  (confidence ${department.confidence.toFixed(2)})`);
  printDistribution(department.probabilities);
  console.log(`  frustration  ${bar(frustration.score / 3)}  ${dim(`level ${frustration.score.toFixed(2)} of 3`)}`);
  console.log(`  urgent       ${bar(urgent.noul)}`);

  // Code owns the policy. Answers are just typed values to compose.
  const actions: string[] = [];
  if (department.confidence < 0.6 || multiple_issues.noul > 0.7) {
    actions.push("send to a human triager (ambiguous or multi-issue)");
  } else {
    actions.push(`queue for ${department.choice}`);
  }
  if (department.choice === "technical" && severity.score >= 2.5) actions.push("page on-call engineer");
  if (department.choice === "billing" && refund_requested.noul > 0.8) actions.push("open refund workflow");
  const priority = 0.5 * (frustration.score / 3) + 0.5 * urgent.noul;
  if (priority > 0.6) actions.push(`bump priority (${priority.toFixed(2)})`);

  console.log(`  ⇒ ${actions.join("; ")}`);
  console.log(dim(`  6 questions, 1 request, ${usage.input_tokens} in / ${usage.output_tokens} out tokens`));
}

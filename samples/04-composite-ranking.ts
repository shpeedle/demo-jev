/**
 * Sample 4 — Composite scoring: judge once, re-rank many ways.
 *
 * Shows: breaking a fuzzy judgment ("who's the best candidate?") into independent
 * Score dimensions, asking them all in parallel per item, then ranking with weights
 * that live in code. Changing priorities re-ranks instantly, with no new model calls.
 */
import { score } from "@typesafe-ai/sdk";
import { dim, heading, makeClient } from "../lib/shared.js";

const client = makeClient();

const candidates = {
  Ana: "8 years backend engineering in Go and Python. Designed the event-sourcing platform handling 40k msgs/sec at a fintech. Tech lead for a team of 4. Speaks at local meetups.",
  Ben: "Engineering manager for 3 years, 12 direct reports across two teams. Previously full-stack (React, Node). Ran hiring and quarterly planning. Introduced on-call rotations.",
  Chen: "Recent CS grad. Built a distributed key-value store as a thesis project in Rust. Internship at a cloud provider working on the storage team. Open-source contributor.",
  Dara: "Generalist: 6 years across mobile, web, and data pipelines at three startups. Founding engineer at one. Mentored juniors informally. Comfortable with Python, Swift, SQL.",
};

const DIMENSIONS = {
  backend_depth: score("How much hands-on backend engineering experience does `resume` show?", [
    "None mentioned",
    "Some exposure or coursework",
    "Solid professional backend work",
    "Senior: owns and designs significant backend systems",
  ]),
  system_design: score("How much experience designing large-scale or distributed systems does `resume` show?", [
    "None mentioned",
    "Academic or small-scale only",
    "Has designed production systems",
    "Has designed high-scale production systems",
  ]),
  leadership: score("How much experience leading or managing engineers does `resume` show?", [
    "None mentioned",
    "Informal mentoring",
    "Tech lead or led a small team",
    "Managed teams with direct reports",
  ]),
  breadth: score("How broad is the technical range shown in `resume`?", [
    "One narrow area",
    "Two related areas",
    "Several areas of the stack",
    "Very broad: many platforms and roles",
  ]),
};
type Dim = keyof typeof DIMENSIONS;

// Step 1: one request per candidate, all four dimensions at once, all candidates concurrently.
const scored = await Promise.all(
  Object.entries(candidates).map(async ([name, resume]) => {
    const { answers } = await client.systemOne({ state: { resume }, questions: DIMENSIONS });
    // Normalise each 0..3 score to 0..1 so weights are comparable.
    const dims = Object.fromEntries(
      Object.entries(answers).map(([k, a]) => [k, a.score / 3]),
    ) as Record<Dim, number>;
    return { name, dims };
  }),
);

heading("Raw dimension scores (0–1)");
console.log(`  ${"".padEnd(6)}${Object.keys(DIMENSIONS).map((d) => d.padStart(15)).join("")}`);
for (const { name, dims } of scored) {
  console.log(`  ${name.padEnd(6)}${Object.values(dims).map((v) => v.toFixed(2).padStart(15)).join("")}`);
}

// Step 2: different roles, different weights. No model calls from here on.
const ROLES: Record<string, Record<Dim, number>> = {
  "Senior backend IC": { backend_depth: 0.45, system_design: 0.4, leadership: 0.05, breadth: 0.1 },
  "Engineering manager": { backend_depth: 0.1, system_design: 0.15, leadership: 0.55, breadth: 0.2 },
  "Founding engineer": { backend_depth: 0.25, system_design: 0.15, leadership: 0.15, breadth: 0.45 },
};

for (const [role, weights] of Object.entries(ROLES)) {
  heading(`Ranking for: ${role}`);
  const ranked = scored
    .map(({ name, dims }) => ({
      name,
      total: (Object.keys(weights) as Dim[]).reduce((sum, d) => sum + weights[d] * dims[d], 0),
    }))
    .sort((a, b) => b.total - a.total);
  ranked.forEach(({ name, total }, i) => console.log(`  ${i + 1}. ${name.padEnd(6)} ${total.toFixed(2)}`));
}
console.log(dim(`\n${scored.length} requests total, then ${Object.keys(ROLES).length} rankings computed in code for free.`));

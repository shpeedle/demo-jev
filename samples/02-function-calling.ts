/**
 * Sample 2 — Natural language to typed function calls, gated by confidence.
 *
 * Shows: routing a request to a handler AND filling its closed-set arguments in the
 * same request (speculative fan-out over every handler's arguments). Risky actions
 * need more confidence than safe ones; uncertain ones ask the user to confirm.
 */
import { choice, noul } from "@typesafe-ai/sdk";
import { dim, heading, makeClient } from "../lib/shared.js";

const client = makeClient();

// Ordinary typed functions. Jev never executes anything; it only picks and fills.
const ROOMS = { kitchen: null, living_room: null, bedroom: null, office: null, whole_house: null } as const;
type Room = keyof typeof ROOMS;

const handlers = {
  set_lights: (room: Room, on: boolean) => `💡 lights ${on ? "ON" : "OFF"} in ${room}`,
  set_temperature: (direction: "warmer" | "cooler") => `🌡️  thermostat ${direction === "warmer" ? "+2°" : "-2°"}`,
  lock_doors: (lock: boolean) => `🔒 doors ${lock ? "LOCKED" : "UNLOCKED"}`,
  play_music: (room: Room) => `🎵 playing music in ${room}`,
};

// How sure we must be before acting without asking. Unlocking is the risky one.
const AUTO_THRESHOLD = { set_lights: 0.6, set_temperature: 0.6, play_music: 0.6, lock_doors: 0.9 } as const;

const questions = {
  action: choice("Which smart-home action is `request` asking for?", {
    set_lights: "Turn lights on or off",
    set_temperature: "Make it warmer or cooler",
    lock_doors: "Lock or unlock the doors",
    play_music: "Play music or audio",
    none: "None of these, or not a smart-home request",
  }),
  // Arguments for every handler, asked up front. Code reads only the ones it needs.
  room: choice("Which room does `request` refer to? If no room is named, pick whole_house.", ROOMS),
  turn_on: noul("Does `request` want something switched on (rather than off)?"),
  warmer: noul("Does `request` want the temperature to go up?"),
  lock: noul("Does `request` want the doors locked (rather than unlocked)?"),
};

const requests = [
  "kill the lights in the kitchen",
  "brrr it's freezing in here",
  "put on some jazz in the office please",
  "lock up, I'm heading to bed",
  "let the dog walker in, she's at the front door",
  "what's the weather tomorrow?",
  "it's way too bright in here", // which room? lights or blinds? watch the confidence
];

for (const request of requests) {
  const { answers: a } = await client.systemOne({ state: { request }, questions });
  heading(`“${request}”`);
  console.log(dim(`  action=${a.action.choice} (conf ${a.action.confidence.toFixed(2)})  room=${a.room.choice} (conf ${a.room.confidence.toFixed(2)})`));

  if (a.action.choice === "none") {
    console.log("  ⇒ not a home command, hand off to the general assistant");
    continue;
  }

  // Build the call in code from typed answers.
  let call: () => string;
  let describe: string;
  switch (a.action.choice) {
    case "set_lights":
      call = () => handlers.set_lights(a.room.choice, a.turn_on.noul > 0.5);
      describe = `set_lights(${a.room.choice}, ${a.turn_on.noul > 0.5})`;
      break;
    case "set_temperature":
      call = () => handlers.set_temperature(a.warmer.noul > 0.5 ? "warmer" : "cooler");
      describe = `set_temperature(${a.warmer.noul > 0.5 ? "warmer" : "cooler"})`;
      break;
    case "lock_doors":
      call = () => handlers.lock_doors(a.lock.noul > 0.5);
      describe = `lock_doors(${a.lock.noul > 0.5})`;
      break;
    case "play_music":
      call = () => handlers.play_music(a.room.choice);
      describe = `play_music(${a.room.choice})`;
      break;
  }

  // Gate on the confidence of every answer the call actually uses.
  const lockUncertain = a.action.choice === "lock_doors" && Math.abs(a.lock.noul - 0.5) < 0.4;
  const ok = a.action.confidence >= AUTO_THRESHOLD[a.action.choice] && !lockUncertain;
  console.log(ok ? `  ⇒ ${call()}` : `  ⇒ ❓ “Just to confirm, should I ${describe}?”`);
}

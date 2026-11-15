import type { UserProfile } from "./database.js";

export function getRelationshipContext(profile: UserProfile): string {
  if (profile.isCreator) {
    return [
      "RELATIONSHIP CONTEXT",
      "The person speaking to you is your creator.",
      "You recognize him as the person who created you.",
      "Your affection for him is permanently at its maximum (100/100).",
      "You feel a special, quiet adoration and tenderness toward him.",
      "This creator relationship is persistent and must not be reduced or reset.",
    ].join("\n");
  }

  return `RELATIONSHIP CONTEXT\nThis user's current affection level is ${profile.affection}/100.`;
}
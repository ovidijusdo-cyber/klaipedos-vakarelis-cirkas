export const PARTY_BALLOT_STATE_ID = "party-ballot-2026-11-07";

export const PARTY_BALLOT_CATEGORIES = [
  { id: "interesting_outfit", label: "Įdomiausia apranga" },
  { id: "evening_energy", label: "Vakaro energija" },
  { id: "unexpected_accent", label: "Netikėčiausias vakaro akcentas" },
] as const;

export type PartyBallotCategoryId = (typeof PARTY_BALLOT_CATEGORIES)[number]["id"];
export type PartyBallotParticipant = { id: string; name: string };

export const PARTY_BALLOT_EXTRA_PARTICIPANTS: PartyBallotParticipant[] = [
  { id: "ballot-only-2026-11-07-1", name: "Kęstutis Jazukevičius" },
  { id: "ballot-only-2026-11-07-2", name: "Simonas Jazukevičius" },
  { id: "ballot-only-2026-11-07-3", name: "Zinaida Jazukevičienė" },
  { id: "ballot-only-2026-11-07-4", name: "Julija Daunorienė" },
  { id: "ballot-only-2026-11-07-5", name: "Luknė Daunorytė" },
  { id: "ballot-only-2026-11-07-6", name: "Živilė" },
  { id: "ballot-only-2026-11-07-7", name: "Džiuljeta Budrienė" },
];

export type PartyBallotVote = {
  categoryId: PartyBallotCategoryId;
  targetPersonId: string;
  deviceHash: string;
  createdAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isPartyBallotCategory(value: unknown): value is PartyBallotCategoryId {
  return PARTY_BALLOT_CATEGORIES.some((category) => category.id === value);
}

export function partyBallotParticipants(payload: unknown): PartyBallotParticipant[] {
  if (!isRecord(payload) || !Array.isArray(payload.reservations)) return [];
  const people = new Map<string, PartyBallotParticipant>();
  for (const reservation of payload.reservations) {
    if (!isRecord(reservation) || !Array.isArray(reservation.people)) continue;
    for (const person of reservation.people) {
      if (!isRecord(person) || person.active === false || typeof person.id !== "string") continue;
      const firstName = typeof person.firstName === "string" ? person.firstName.trim() : "";
      const lastName = typeof person.lastName === "string" ? person.lastName.trim() : "";
      if (!firstName) continue;
      people.set(person.id, { id: person.id, name: lastName ? `${firstName} ${lastName}` : firstName });
    }
  }
  for (const person of PARTY_BALLOT_EXTRA_PARTICIPANTS) people.set(person.id, person);
  return [...people.values()].sort((a, b) => a.name.localeCompare(b.name, "lt"));
}

export function parsePartyBallotVotes(payload: unknown): PartyBallotVote[] {
  if (!isRecord(payload) || !Array.isArray(payload.votes)) return [];
  return payload.votes.filter((vote: unknown): vote is PartyBallotVote =>
    isRecord(vote) &&
    isPartyBallotCategory(vote.categoryId) &&
    typeof vote.targetPersonId === "string" &&
    typeof vote.deviceHash === "string" &&
    /^[a-f0-9]{64}$/.test(vote.deviceHash) &&
    typeof vote.createdAt === "string",
  );
}

export function hasDeviceVoted(votes: PartyBallotVote[], deviceHash: string, categoryId: PartyBallotCategoryId) {
  return votes.some((vote) => vote.deviceHash === deviceHash && vote.categoryId === categoryId);
}

export function partyBallotResults(votes: PartyBallotVote[], participants: PartyBallotParticipant[]) {
  const names = new Map(participants.map((person) => [person.id, person.name]));
  return PARTY_BALLOT_CATEGORIES.map((category) => {
    const counts = new Map<string, number>();
    for (const vote of votes) {
      if (vote.categoryId !== category.id || !names.has(vote.targetPersonId)) continue;
      counts.set(vote.targetPersonId, (counts.get(vote.targetPersonId) ?? 0) + 1);
    }
    const leaders = [...counts].map(([personId, count]) => ({ personId, name: names.get(personId)!, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "lt"))
      .slice(0, 3);
    return { categoryId: category.id, total: [...counts.values()].reduce((sum, count) => sum + count, 0), leaders };
  });
}

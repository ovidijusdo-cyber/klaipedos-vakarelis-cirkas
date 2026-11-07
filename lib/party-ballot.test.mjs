import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hasDeviceVoted,
  parsePartyBallotVotes,
  PARTY_BALLOT_EXTRA_PARTICIPANTS,
  partyBallotParticipants,
  partyBallotResults,
} from "./party-ballot.ts";

const deviceHash = "a".repeat(64);
const participants = [
  { id: "1", name: "Asta Jonaitė" },
  { id: "2", name: "Jonas Petraitis" },
];

function vote(categoryId, targetPersonId, hash = deviceHash) {
  return { categoryId, targetPersonId, deviceHash: hash, createdAt: "2026-11-07T18:00:00.000Z" };
}

test("participants include only active registered people and expose names, not contact data", () => {
  const result = partyBallotParticipants({ reservations: [
    { contactPhone: "secret", people: [
      { id: "2", firstName: "Jonas", lastName: "Petraitis", active: true },
      { id: "3", firstName: "Išregistruotas", lastName: "Asmuo", active: false },
      { id: "4", firstName: "Irutė", lastName: "", active: true },
    ] },
    { people: [{ id: "1", firstName: "Asta", lastName: "Jonaitė", active: true }] },
  ] });
  assert.deepEqual(result.filter((person) => !person.id.startsWith("ballot-only-")), [
    participants[0],
    { id: "4", name: "Irutė" },
    participants[1],
  ]);
  assert.equal(result.some((person) => person.name.includes("Išregistruotas")), false);
  assert.equal(result.some((person) => "contactPhone" in person), false);
});

test("seven voting-only people are included without adding registrations", () => {
  const result = partyBallotParticipants({ reservations: [] });
  assert.equal(result.length, 7);
  assert.deepEqual(new Set(result.map((person) => person.name)), new Set(PARTY_BALLOT_EXTRA_PARTICIPANTS.map((person) => person.name)));
  assert.ok(result.every((person) => person.id.startsWith("ballot-only-")));
  const leader = partyBallotResults([vote("interesting_outfit", result[0].id)], result)[0].leaders[0];
  assert.equal(leader.name, result[0].name);
  assert.equal(leader.count, 1);
});

test("one device can vote once per category, but in another category", () => {
  const votes = [vote("interesting_outfit", "1")];
  assert.equal(hasDeviceVoted(votes, deviceHash, "interesting_outfit"), true);
  assert.equal(hasDeviceVoted(votes, deviceHash, "evening_energy"), false);
  assert.equal(hasDeviceVoted(votes, "b".repeat(64), "interesting_outfit"), false);
});

test("results count votes per nomination and show only the top three active people", () => {
  const votes = [
    vote("interesting_outfit", "1"),
    vote("interesting_outfit", "1", "b".repeat(64)),
    vote("interesting_outfit", "2", "c".repeat(64)),
    vote("interesting_outfit", "removed", "d".repeat(64)),
    vote("evening_energy", "2", "e".repeat(64)),
  ];
  const results = partyBallotResults(votes, participants);
  assert.deepEqual(results[0].leaders.map(({ name, count }) => [name, count]), [
    ["Asta Jonaitė", 2], ["Jonas Petraitis", 1],
  ]);
  assert.equal(results[0].total, 3);
  assert.equal(results[1].total, 1);
  assert.equal(results[2].total, 0);
});

test("top three are ordered by votes, with alphabetical ties and no fourth place", () => {
  const people = [
    ...participants,
    { id: "3", name: "Milda Kazlauskaitė" },
    { id: "4", name: "Rasa Antanaitė" },
  ];
  const votes = [
    vote("interesting_outfit", "4", "a".repeat(64)),
    vote("interesting_outfit", "4", "b".repeat(64)),
    vote("interesting_outfit", "4", "c".repeat(64)),
    vote("interesting_outfit", "2", "d".repeat(64)),
    vote("interesting_outfit", "2", "e".repeat(64)),
    vote("interesting_outfit", "3", "f".repeat(64)),
    vote("interesting_outfit", "1", "0".repeat(64)),
  ];
  const result = partyBallotResults(votes, people)[0];
  assert.equal(result.total, 7);
  assert.deepEqual(result.leaders.map(({ name, count }) => [name, count]), [
    ["Rasa Antanaitė", 3],
    ["Jonas Petraitis", 2],
    ["Asta Jonaitė", 1],
  ]);
});

test("stored votes with invalid categories or device hashes are ignored", () => {
  const valid = vote("interesting_outfit", "1");
  assert.deepEqual(parsePartyBallotVotes({ votes: [valid, { ...valid, categoryId: "legacy" }, { ...valid, deviceHash: "bad" }] }), [valid]);
});

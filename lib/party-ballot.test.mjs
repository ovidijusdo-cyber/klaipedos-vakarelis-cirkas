import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hasDeviceVoted,
  parsePartyBallotVotes,
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
    ] },
    { people: [{ id: "1", firstName: "Asta", lastName: "Jonaitė", active: true }] },
  ] });
  assert.deepEqual(result, participants);
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

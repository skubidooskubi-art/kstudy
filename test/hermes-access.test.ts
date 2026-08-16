import assert from "node:assert/strict";
import test from "node:test";

import {
  getOwnedSessionIds,
  ownsResource,
  registerResource,
  type HermesResourceCollection,
  type HermesResourceRecord,
} from "../lib/hermes-access";

class DuplicateKeyError extends Error {
  code = 11000;
}

class InMemoryResources implements HermesResourceCollection {
  private readonly records = new Map<string, HermesResourceRecord>();

  async insertOne(record: HermesResourceRecord) {
    if (this.records.has(record._id)) {
      throw new DuplicateKeyError("duplicate resource id");
    }

    this.records.set(record._id, structuredClone(record));
    return { acknowledged: true };
  }

  async findOne(query: { _id: string; ownerId?: string }) {
    const record = this.records.get(query._id);
    if (!record || (query.ownerId && record.ownerId !== query.ownerId)) {
      return null;
    }

    return structuredClone(record);
  }

  find(query: { ownerId: string; kind: "session" | "stream" }) {
    const matches = [...this.records.values()].filter(
      (record) => record.ownerId === query.ownerId && record.kind === query.kind,
    );

    return {
      toArray: async () => structuredClone(matches),
    };
  }
}

test("registerResource binds a new session to its authenticated owner", async () => {
  const resources = new InMemoryResources();

  await registerResource(resources, {
    kind: "session",
    resourceId: "session-1",
    ownerId: "user-a",
  });

  assert.equal(await ownsResource(resources, "session", "session-1", "user-a"), true);
  assert.equal(await ownsResource(resources, "session", "session-1", "user-b"), false);
});

test("registerResource refuses to transfer an existing resource to another owner", async () => {
  const resources = new InMemoryResources();

  await registerResource(resources, {
    kind: "session",
    resourceId: "session-1",
    ownerId: "user-a",
  });

  await assert.rejects(
    registerResource(resources, {
      kind: "session",
      resourceId: "session-1",
      ownerId: "user-b",
    }),
    /already belongs to another user/,
  );

  assert.equal(await ownsResource(resources, "session", "session-1", "user-a"), true);
});

test("registerResource permits an idempotent registration by the same owner", async () => {
  const resources = new InMemoryResources();

  const resource = {
    kind: "session" as const,
    resourceId: "session-1",
    ownerId: "user-a",
  };

  await registerResource(resources, resource);
  await registerResource(resources, resource);

  assert.equal(await ownsResource(resources, "session", "session-1", "user-a"), true);
});

test("getOwnedSessionIds returns only sessions belonging to the requested owner", async () => {
  const resources = new InMemoryResources();

  await registerResource(resources, {
    kind: "session",
    resourceId: "session-a",
    ownerId: "user-a",
  });
  await registerResource(resources, {
    kind: "session",
    resourceId: "session-b",
    ownerId: "user-b",
  });
  await registerResource(resources, {
    kind: "stream",
    resourceId: "stream-a",
    ownerId: "user-a",
    sessionId: "session-a",
  });

  assert.deepEqual(await getOwnedSessionIds(resources, "user-a"), new Set(["session-a"]));
});

test("a stream registration retains its parent session", async () => {
  const resources = new InMemoryResources();

  await registerResource(resources, {
    kind: "stream",
    resourceId: "stream-a",
    ownerId: "user-a",
    sessionId: "session-a",
  });

  const stored = await resources.findOne({ _id: "stream:stream-a" });
  assert.equal(stored?.sessionId, "session-a");
});

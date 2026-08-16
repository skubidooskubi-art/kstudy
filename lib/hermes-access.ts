export type HermesResourceKind = "session" | "stream";

export type HermesResourceRecord = {
  _id: string;
  kind: HermesResourceKind;
  resourceId: string;
  ownerId: string;
  sessionId?: string;
  createdAt: Date;
};

type ResourceQuery = {
  _id: string;
  ownerId?: string;
};

type OwnedSessionQuery = {
  ownerId: string;
  kind: HermesResourceKind;
};

export interface HermesResourceCollection {
  insertOne(record: HermesResourceRecord): Promise<unknown>;
  findOne(query: ResourceQuery): Promise<HermesResourceRecord | null>;
  find(query: OwnedSessionQuery): {
    toArray(): Promise<HermesResourceRecord[]>;
  };
}

type RegisterResourceInput = {
  kind: HermesResourceKind;
  resourceId: string;
  ownerId: string;
  sessionId?: string;
};

function resourceKey(kind: HermesResourceKind, resourceId: string): string {
  return `${kind}:${resourceId}`;
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export async function registerResource(
  resources: HermesResourceCollection,
  input: RegisterResourceInput,
): Promise<void> {
  const record: HermesResourceRecord = {
    _id: resourceKey(input.kind, input.resourceId),
    kind: input.kind,
    resourceId: input.resourceId,
    ownerId: input.ownerId,
    sessionId: input.sessionId,
    createdAt: new Date(),
  };

  try {
    await resources.insertOne(record);
    return;
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }
  }

  const existing = await resources.findOne({ _id: record._id });
  if (existing?.ownerId === input.ownerId && existing.kind === input.kind) {
    return;
  }

  throw new Error("Hermes resource already belongs to another user");
}

export async function ownsResource(
  resources: HermesResourceCollection,
  kind: HermesResourceKind,
  resourceId: string,
  ownerId: string,
): Promise<boolean> {
  const record = await resources.findOne({
    _id: resourceKey(kind, resourceId),
    ownerId,
  });

  return record?.kind === kind;
}

export async function getOwnedSessionIds(
  resources: HermesResourceCollection,
  ownerId: string,
): Promise<Set<string>> {
  const records = await resources.find({ ownerId, kind: "session" }).toArray();
  return new Set(records.map((record) => record.resourceId));
}

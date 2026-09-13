import { describe, expect, it, vi } from "vitest";

import {
  DatabaseRuntime,
  type DatabaseRuntimePort,
  DatabaseUnavailableError,
} from "../../src/database/database.js";

type TestTransaction = Readonly<{ id: string }>;

class TestClient implements DatabaseRuntimePort<TestTransaction> {
  readonly connect = vi.fn(async () => undefined);
  readonly close = vi.fn(async () => undefined);

  async transaction<Result>(
    callback: (value: TestTransaction) => PromiseLike<Result>,
  ): Promise<Result> {
    return callback({ id: "tx-1" });
  }
}

describe("DatabaseRuntime", () => {
  it("connects once, probes readiness, and executes transactions", async () => {
    const client = new TestClient();
    const probe = vi.fn(async () => undefined);
    const database = new DatabaseRuntime<TestTransaction, TestClient>({
      client,
      probe,
    });

    await Promise.all([database.connect(), database.connect()]);
    await database.readinessCheck();
    const result = await database.transaction(
      async (transaction) => transaction.id,
    );

    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(probe).toHaveBeenCalledTimes(2);
    expect(result).toBe("tx-1");
  });

  it("closes its client idempotently", async () => {
    const client = new TestClient();
    const database = new DatabaseRuntime<TestTransaction, TestClient>({
      client,
      probe: async () => undefined,
    });

    await database.connect();
    await database.close();
    await database.close();

    expect(client.close).toHaveBeenCalledTimes(1);
  });

  it("sanitizes connection failures as an unavailable error", async () => {
    const client = new TestClient();
    client.connect.mockRejectedValueOnce(
      new Error("postgres://secret:password@database/internal"),
    );
    const database = new DatabaseRuntime<TestTransaction, TestClient>({
      client,
      probe: async () => undefined,
    });

    const error = await database.connect().catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(DatabaseUnavailableError);
    expect(error).toMatchObject({
      statusCode: 503,
      code: "DATABASE_UNAVAILABLE",
      cause: undefined,
    });
    expect(String(error)).not.toContain("secret");
  });

  it("loads Temporal before constructing the Prisma runtime", () => {
    expect(Reflect.get(globalThis, "Temporal")).toBeDefined();
  });
});

import "temporal-polyfill/full/global";

import postgres, {
  type PostgresClient,
} from "@prisma/orm-postgres/runtime";

import contractJson from "../../prisma/contract.json" with { type: "json" };
import type { Contract } from "../../prisma/contract.js";
import { AppError } from "../shared/errors/app-error.js";

export type DatabaseClient = PostgresClient<Contract>;
type TransactionCallback = Parameters<DatabaseClient["transaction"]>[0];
export type DatabaseTransaction = Parameters<TransactionCallback>[0];

export type DatabaseRuntimePort<Transaction> = Readonly<{
  connect(): Promise<unknown>;
  close(): Promise<void>;
  transaction<Result>(
    callback: (transaction: Transaction) => PromiseLike<Result>,
  ): Promise<Result>;
}>;

export type DatabaseRuntimeOptions<
  Transaction,
  Client extends DatabaseRuntimePort<Transaction>,
> = Readonly<{
  client: Client;
  probe(client: Client): Promise<void>;
}>;

export class DatabaseUnavailableError extends AppError {
  constructor() {
    super({
      statusCode: 503,
      code: "DATABASE_UNAVAILABLE",
      message: "La base de datos no está disponible temporalmente.",
    });
    this.name = "DatabaseUnavailableError";
  }
}

export class DatabaseRuntime<
  Transaction,
  Client extends DatabaseRuntimePort<Transaction>,
> {
  readonly client: Client;
  readonly #probe: (client: Client) => Promise<void>;
  #connectPromise: Promise<void> | undefined;
  #connected = false;
  #closed = false;

  constructor(options: DatabaseRuntimeOptions<Transaction, Client>) {
    this.client = options.client;
    this.#probe = options.probe;
  }

  async connect(): Promise<void> {
    if (this.#closed) {
      throw new DatabaseUnavailableError();
    }
    if (this.#connected) {
      return;
    }
    if (this.#connectPromise !== undefined) {
      return this.#connectPromise;
    }

    const pending = (async () => {
      try {
        await this.client.connect();
        await this.#probe(this.client);
        this.#connected = true;
      } catch {
        await this.client.close().catch(() => undefined);
        this.#closed = true;
        throw new DatabaseUnavailableError();
      }
    })();
    this.#connectPromise = pending;

    try {
      await pending;
    } finally {
      this.#connectPromise = undefined;
    }
  }

  async readinessCheck(): Promise<void> {
    if (!this.#connected) {
      await this.connect();
      return;
    }

    try {
      await this.#probe(this.client);
    } catch {
      throw new DatabaseUnavailableError();
    }
  }

  async transaction<Result>(
    callback: (transaction: Transaction) => PromiseLike<Result>,
  ): Promise<Result> {
    await this.connect();
    return this.client.transaction(callback);
  }

  async close(): Promise<void> {
    if (this.#closed) {
      return;
    }

    this.#closed = true;
    await this.#connectPromise?.catch(() => undefined);
    await this.client.close();
    this.#connected = false;
  }
}

export type CreatePostgresDatabaseOptions = Readonly<{
  databaseUrl: string;
  connectionTimeoutMillis?: number;
  idleTimeoutMillis?: number;
}>;

async function probePostgres(client: DatabaseClient): Promise<void> {
  const plan = client.raw.sql`SELECT 1 AS ok`
    .returnsRow({ ok: "pg/int4@1" })
    .build();
  const rows = await client.runtime().query(plan);

  if (rows.length !== 1 || rows[0]?.ok !== 1) {
    throw new Error("Unexpected database readiness response.");
  }
}

export function createPostgresDatabase(
  options: CreatePostgresDatabaseOptions,
): DatabaseRuntime<DatabaseTransaction, DatabaseClient> {
  const client = postgres<Contract>({
    contractJson,
    url: options.databaseUrl,
    poolOptions: {
      ...(options.connectionTimeoutMillis === undefined
        ? {}
        : { connectionTimeoutMillis: options.connectionTimeoutMillis }),
      ...(options.idleTimeoutMillis === undefined
        ? {}
        : { idleTimeoutMillis: options.idleTimeoutMillis }),
    },
  });

  return new DatabaseRuntime({ client, probe: probePostgres });
}

#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/8889bedd55538398790f64ad265e516b000bc65af72ffed7bf5076a53f44fa55/contract';
import endContract from '../../snapshots/8889bedd55538398790f64ad265e516b000bc65af72ffed7bf5076a53f44fa55/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/f1112244edcdccb2193887f4d89457033866f875e88fe2d1a6278ccbbcaeeccf/contract';
import startContract from '../../snapshots/f1112244edcdccb2193887f4d89457033866f875e88fe2d1a6278ccbbcaeeccf/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'users',
        constraint: 'user_identity_valid_962ac172',
      }),
      this.addColumn({
        schema: 'public',
        table: 'users',
        column: col('first_name', 'character varying(100)', {
          notNull: true,
          default: lit('Usuario'),
          codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 100 } },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'users',
        column: col('last_name', 'character varying(100)', {
          notNull: true,
          default: lit('TraceLink'),
          codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 100 } },
        }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'users',
        constraint: 'user_identity_valid_05b3fcc0',
        expression:
          '"email_normalized" = lower(btrim("email_normalized")) AND char_length(btrim("first_name")) > 0 AND char_length(btrim("last_name")) > 0 AND char_length("password_hash") > 0',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

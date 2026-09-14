#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/952d39a88bdde782cbbdc991c216ee0f55539cdd058bd308c3565a05049ae8f1/contract';
import endContract from '../../snapshots/952d39a88bdde782cbbdc991c216ee0f55539cdd058bd308c3565a05049ae8f1/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/ea69501fa51002568568a701edee9bd659f192773925b28f266236dfa06a4e37/contract';
import startContract from '../../snapshots/ea69501fa51002568568a701edee9bd659f192773925b28f266236dfa06a4e37/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.alterColumnType({
        schema: 'public',
        table: 'order_status_events',
        column: 'reason',
        options: {
          qualifiedTargetType: 'character varying(1000)',
          formatTypeExpected: 'character varying(1000)',
          rawTargetTypeForLabel: 'character varying(1000)',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/8ef4a570dfab349ebb0db12a55c418867dced833652a4d2b5dfa87ea23c3c2eb/contract';
import endContract from '../../snapshots/8ef4a570dfab349ebb0db12a55c418867dced833652a4d2b5dfa87ea23c3c2eb/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/952d39a88bdde782cbbdc991c216ee0f55539cdd058bd308c3565a05049ae8f1/contract';
import startContract from '../../snapshots/952d39a88bdde782cbbdc991c216ee0f55539cdd058bd308c3565a05049ae8f1/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.alterColumnType({
        schema: 'public',
        table: 'tracking_events',
        column: 'description',
        options: {
          qualifiedTargetType: 'character varying(2000)',
          formatTypeExpected: 'character varying(2000)',
          rawTargetTypeForLabel: 'character varying(2000)',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

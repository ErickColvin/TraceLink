#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/8043015b27b719508697e4eb1e9d67b20bf2e86e084981a0e244069229ca7db8/contract';
import endContract from '../../snapshots/8043015b27b719508697e4eb1e9d67b20bf2e86e084981a0e244069229ca7db8/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/8ef4a570dfab349ebb0db12a55c418867dced833652a4d2b5dfa87ea23c3c2eb/contract';
import startContract from '../../snapshots/8ef4a570dfab349ebb0db12a55c418867dced833652a4d2b5dfa87ea23c3c2eb/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.alterColumnType({
        schema: 'public',
        table: 'organization_settings',
        column: 'pickup_address',
        options: {
          qualifiedTargetType: 'character varying(500)',
          formatTypeExpected: 'character varying(500)',
          rawTargetTypeForLabel: 'character varying(500)',
        },
      }),
      this.alterColumnType({
        schema: 'public',
        table: 'organizations',
        column: 'locale',
        options: {
          qualifiedTargetType: 'character varying(35)',
          formatTypeExpected: 'character varying(35)',
          rawTargetTypeForLabel: 'character varying(35)',
        },
      }),
      this.alterColumnType({
        schema: 'public',
        table: 'organizations',
        column: 'timezone',
        options: {
          qualifiedTargetType: 'character varying(100)',
          formatTypeExpected: 'character varying(100)',
          rawTargetTypeForLabel: 'character varying(100)',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/c35ce1f00bd0d905022218508b3cc282934124b88a20ba20ad1ed01d6f867c4f/contract';
import startContract from '../../snapshots/c35ce1f00bd0d905022218508b3cc282934124b88a20ba20ad1ed01d6f867c4f/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/ea69501fa51002568568a701edee9bd659f192773925b28f266236dfa06a4e37/contract';
import endContract from '../../snapshots/ea69501fa51002568568a701edee9bd659f192773925b28f266236dfa06a4e37/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'inventory_movements',
        constraint: 'inventory_movement_quantities_valid_c6f6647e',
      }),
      this.addColumn({
        schema: 'public',
        table: 'inventory_movements',
        column: col('destination_location', 'character varying(200)', {
          codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 200 } },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'inventory_movements',
        column: col('new_reserved_quantity', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'inventory_movements',
        column: col('origin_location', 'character varying(200)', {
          notNull: true,
          default: lit('Sin especificar'),
          codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 200 } },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'inventory_movements',
        column: col('previous_reserved_quantity', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'inventory_movements',
        constraint: 'inventory_movement_quantities_valid_29612697',
        expression:
          '"quantity_delta" <> 0 AND "previous_physical_quantity" >= 0 AND "new_physical_quantity" >= 0 AND "new_physical_quantity" = "previous_physical_quantity" + "quantity_delta" AND "previous_reserved_quantity" >= 0 AND "previous_reserved_quantity" <= "previous_physical_quantity" AND "new_reserved_quantity" >= 0 AND "new_reserved_quantity" <= "new_physical_quantity"',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

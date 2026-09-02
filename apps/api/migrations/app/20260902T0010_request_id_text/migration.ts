#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/8889bedd55538398790f64ad265e516b000bc65af72ffed7bf5076a53f44fa55/contract';
import startContract from '../../snapshots/8889bedd55538398790f64ad265e516b000bc65af72ffed7bf5076a53f44fa55/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/c35ce1f00bd0d905022218508b3cc282934124b88a20ba20ad1ed01d6f867c4f/contract';
import endContract from '../../snapshots/c35ce1f00bd0d905022218508b3cc282934124b88a20ba20ad1ed01d6f867c4f/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, rawSql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      rawSql({
        id: 'column.public.audit_logs.request_id.uuid-to-varchar',
        label: 'Change audit_logs.request_id from uuid to varchar(128)',
        operationClass: 'widening',
        target: {
          id: 'postgres',
          details: {
            schema: 'public',
            objectType: 'column',
            name: 'request_id',
            table: 'audit_logs',
          },
        },
        precheck: [{
          description: 'ensure audit request_id is uuid',
          sql: `SELECT (data_type = 'uuid') AS result
                  FROM information_schema.columns
                 WHERE table_schema = 'public'
                   AND table_name = 'audit_logs'
                   AND column_name = 'request_id'`,
        }],
        execute: [{
          description: 'cast audit request_id to varchar(128)',
          sql: `ALTER TABLE "public"."audit_logs"
                  ALTER COLUMN "request_id" TYPE character varying(128)
                  USING "request_id"::text`,
        }],
        postcheck: [{
          description: 'verify audit request_id is varchar(128)',
          sql: `SELECT (data_type = 'character varying' AND character_maximum_length = 128) AS result
                  FROM information_schema.columns
                 WHERE table_schema = 'public'
                   AND table_name = 'audit_logs'
                   AND column_name = 'request_id'`,
        }],
      }),
      rawSql({
        id: 'column.public.idempotency_records.original_request_id.uuid-to-varchar',
        label: 'Change idempotency_records.original_request_id from uuid to varchar(128)',
        operationClass: 'widening',
        target: {
          id: 'postgres',
          details: {
            schema: 'public',
            objectType: 'column',
            name: 'original_request_id',
            table: 'idempotency_records',
          },
        },
        precheck: [{
          description: 'ensure idempotency original_request_id is uuid',
          sql: `SELECT (data_type = 'uuid') AS result
                  FROM information_schema.columns
                 WHERE table_schema = 'public'
                   AND table_name = 'idempotency_records'
                   AND column_name = 'original_request_id'`,
        }],
        execute: [{
          description: 'cast idempotency original_request_id to varchar(128)',
          sql: `ALTER TABLE "public"."idempotency_records"
                  ALTER COLUMN "original_request_id" TYPE character varying(128)
                  USING "original_request_id"::text`,
        }],
        postcheck: [{
          description: 'verify idempotency original_request_id is varchar(128)',
          sql: `SELECT (data_type = 'character varying' AND character_maximum_length = 128) AS result
                  FROM information_schema.columns
                 WHERE table_schema = 'public'
                   AND table_name = 'idempotency_records'
                   AND column_name = 'original_request_id'`,
        }],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

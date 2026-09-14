#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/4c27837b13335fd2a0e15acd8d3bdf7b950a7cc7fa5bb8c7c3c6eabbbdbfaecd/contract';
import endContract from '../../snapshots/4c27837b13335fd2a0e15acd8d3bdf7b950a7cc7fa5bb8c7c3c6eabbbdbfaecd/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/8f5007ad88822c9ece5890c5228418a473a1a4c95526960a54bcabec014bb966/contract';
import startContract from '../../snapshots/8f5007ad88822c9ece5890c5228418a473a1a4c95526960a54bcabec014bb966/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'outbox_events',
        columns: [
          col('attempts', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('created_at', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('delivered_at', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('event_key', 'character varying(200)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 200 } },
          }),
          col('event_type', 'character varying(120)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 120 } },
          }),
          col('id', 'uuid', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/uuid@1' },
          }),
          col('last_error', 'character varying(1000)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 1000 } },
          }),
          col('locked_at', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('max_attempts', 'int4', {
            notNull: true,
            default: lit(5),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('next_attempt_at', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('organization_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('payload', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('provider_message_id', 'character varying(200)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 200 } },
          }),
          col('recipient_email', 'character varying(320)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 320 } },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'outbox_event_state_valid_566c2672',
            'char_length(btrim("event_key")) > 0 AND char_length(btrim("event_type")) > 0 AND char_length(btrim("recipient_email")) > 0 AND "attempts" >= 0 AND "max_attempts" BETWEEN 1 AND 20 AND "attempts" <= "max_attempts" AND (("status" = \'PENDING\' AND "locked_at" IS NULL AND "delivered_at" IS NULL) OR ("status" = \'PROCESSING\' AND "locked_at" IS NOT NULL AND "delivered_at" IS NULL) OR ("status" = \'DELIVERED\' AND "locked_at" IS NULL AND "delivered_at" IS NOT NULL) OR ("status" = \'DEAD\' AND "locked_at" IS NULL AND "delivered_at" IS NULL))',
          ),
          checkExpression(
            'outbox_events_status_check_8211561f',
            "\"status\" IN ('PENDING', 'PROCESSING', 'DELIVERED', 'DEAD')",
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'outbox_events',
        constraint: 'outbox_event_dedup_key',
        columns: ['organization_id', 'event_key'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'outbox_events',
        constraint: 'outbox_event_tenant_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'outbox_events',
        index: 'outbox_event_delivery_idx',
        columns: ['status', 'next_attempt_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'outbox_events',
        index: 'outbox_event_tenant_type_idx',
        columns: ['organization_id', 'event_type', 'created_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'outbox_events',
        index: 'outbox_events_organization_id_idx_1a5cd3f5',
        columns: ['organization_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'outbox_events',
        foreignKey: {
          name: 'outbox_event_organization_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

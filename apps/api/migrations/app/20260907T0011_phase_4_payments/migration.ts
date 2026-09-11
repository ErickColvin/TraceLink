#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/8043015b27b719508697e4eb1e9d67b20bf2e86e084981a0e244069229ca7db8/contract';
import startContract from '../../snapshots/8043015b27b719508697e4eb1e9d67b20bf2e86e084981a0e244069229ca7db8/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/8f5007ad88822c9ece5890c5228418a473a1a4c95526960a54bcabec014bb966/contract';
import endContract from '../../snapshots/8f5007ad88822c9ece5890c5228418a473a1a4c95526960a54bcabec014bb966/contract.json' with { type: 'json' };
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
      this.dropCheckConstraint({
        schema: 'public',
        table: 'inventory_reservations',
        constraint: 'inventory_reservations_status_check_e4d0c47e',
      }),
      this.createTable({
        schema: 'public',
        table: 'payment_attempts',
        columns: [
          col('attempt_number', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('checkout_url', 'character varying(2048)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 2048 } },
          }),
          col('completed_at', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('created_at', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('error_code', 'character varying(160)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 160 } },
          }),
          col('error_message', 'character varying(1000)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 1000 } },
          }),
          col('id', 'uuid', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/uuid@1' },
          }),
          col('organization_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('payment_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('provider_order_id', 'character varying(160)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 160 } },
          }),
          col('provider_preference_id', 'character varying(160)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 160 } },
          }),
          col('started_at', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('CREATED'),
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
            'payment_attempt_values_valid_c3adc581',
            '"attempt_number" > 0 AND ("provider_order_id" IS NULL OR char_length(btrim("provider_order_id")) > 0) AND ("provider_preference_id" IS NULL OR char_length(btrim("provider_preference_id")) > 0) AND ("checkout_url" IS NULL OR "checkout_url" ~ \'^https?://\')',
          ),
          checkExpression(
            'payment_attempts_status_check_ef2a1e2b',
            "\"status\" IN ('CREATED', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REFUNDED', 'ERROR')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'payment_provider_events',
        columns: [
          col('event_type', 'character varying(120)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 120 } },
          }),
          col('id', 'uuid', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/uuid@1' },
          }),
          col('last_processing_error', 'character varying(1000)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 1000 } },
          }),
          col('organization_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('payload_hash', 'bytea', { notNull: true, codecRef: { codecId: 'pg/bytea@1' } }),
          col('payment_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('processed', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('processed_at', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('processing_attempts', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('provider', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('provider_event_id', 'character varying(160)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 160 } },
          }),
          col('provider_resource_id', 'character varying(160)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 160 } },
          }),
          col('received_at', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('sanitized_payload', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'payment_provider_event_values_valid_9864c1b3',
            'char_length(btrim("provider_event_id")) > 0 AND char_length(btrim("event_type")) > 0 AND octet_length("payload_hash") = 32 AND "processing_attempts" >= 0 AND ((NOT "processed" AND "processed_at" IS NULL) OR ("processed" AND "processed_at" IS NOT NULL))',
          ),
          checkExpression(
            'payment_provider_events_provider_check_48eddf40',
            "\"provider\" IN ('MERCADOPAGO', 'FAKE')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'payments',
        columns: [
          col('amount', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('approved_at', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('cancelled_at', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('created_at', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('currency', 'character varying(3)', {
            notNull: true,
            default: lit('CLP'),
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 3 } },
          }),
          col('id', 'uuid', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/uuid@1' },
          }),
          col('last_reconciled_at', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('order_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('organization_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('provider', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('provider_external_reference', 'character varying(160)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 160 } },
          }),
          col('provider_payment_id', 'character varying(160)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 160 } },
          }),
          col('provider_status', 'character varying(120)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 120 } },
          }),
          col('provider_status_detail', 'character varying(240)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 240 } },
          }),
          col('refunded_at', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('CREATED'),
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
            'payment_values_valid_1e7d7f73',
            '"amount" > 0 AND "currency" = upper(btrim("currency")) AND char_length("currency") = 3 AND char_length(btrim("provider_external_reference")) > 0 AND ("provider_payment_id" IS NULL OR char_length(btrim("provider_payment_id")) > 0)',
          ),
          checkExpression(
            'payments_provider_check_48eddf40',
            "\"provider\" IN ('MERCADOPAGO', 'FAKE')",
          ),
          checkExpression(
            'payments_status_check_ef2a1e2b',
            "\"status\" IN ('CREATED', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REFUNDED', 'ERROR')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'refunds',
        columns: [
          col('actor_user_id', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('amount', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('completed_at', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('created_at', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'uuid', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/uuid@1' },
          }),
          col('organization_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('payment_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('provider_refund_id', 'character varying(160)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 160 } },
          }),
          col('reason', 'character varying(1000)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 1000 } },
          }),
          col('requested_at', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('CREATED'),
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
            'refund_values_valid_9e5d2734',
            '"amount" > 0 AND char_length(btrim("reason")) >= 3 AND ("provider_refund_id" IS NULL OR char_length(btrim("provider_refund_id")) > 0)',
          ),
          checkExpression(
            'refunds_status_check_ef2a1e2b',
            "\"status\" IN ('CREATED', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REFUNDED', 'ERROR')",
          ),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'inventory_movements',
        column: col('reservation_id', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'inventory_movements',
        constraint: 'inventory_movement_reservation_sale_valid_d8fc8525',
        expression: '"reservation_id" IS NULL OR "type" = \'SALE\'',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'inventory_reservations',
        constraint: 'inventory_reservations_status_check_8533bca8',
        expression: "\"status\" IN ('ACTIVE', 'COMMITTED', 'CONSUMED', 'RELEASED', 'EXPIRED')",
      }),
      this.addUnique({
        schema: 'public',
        table: 'payment_attempts',
        constraint: 'payment_attempt_number_key',
        columns: ['organization_id', 'payment_id', 'attempt_number'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'payment_attempts',
        constraint: 'payment_attempt_tenant_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'payment_provider_events',
        constraint: 'payment_provider_event_dedup_key',
        columns: ['provider', 'provider_event_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'payment_provider_events',
        constraint: 'payment_provider_event_tenant_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'payments',
        constraint: 'payment_order_key',
        columns: ['organization_id', 'order_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'payments',
        constraint: 'payment_provider_external_reference_key',
        columns: ['provider', 'provider_external_reference'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'payments',
        constraint: 'payment_tenant_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'refunds',
        constraint: 'refund_full_payment_key',
        columns: ['organization_id', 'payment_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'refunds',
        constraint: 'refund_tenant_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventory_movements',
        index: 'inventory_movement_reservation_key_3c5dba80',
        columns: ['organization_id', 'reservation_id'],
        extras: { where: '"reservation_id" IS NOT NULL', unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'payment_attempts',
        index: 'payment_attempt_payment_status_idx',
        columns: ['organization_id', 'payment_id', 'status', 'created_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payment_attempts',
        index: 'payment_attempt_provider_order_key_207184d0',
        columns: ['organization_id', 'provider_order_id'],
        extras: { where: '"provider_order_id" IS NOT NULL', unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'payment_attempts',
        index: 'payment_attempt_provider_preference_key_45ef268b',
        columns: ['organization_id', 'provider_preference_id'],
        extras: { where: '"provider_preference_id" IS NOT NULL', unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'payment_attempts',
        index: 'payment_attempt_reconciliation_idx',
        columns: ['organization_id', 'status', 'updated_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payment_attempts',
        index: 'payment_attempts_organization_id_idx_1a5cd3f5',
        columns: ['organization_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payment_attempts',
        index: 'payment_attempts_organization_id_payment_id_idx_2d32040f',
        columns: ['organization_id', 'payment_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payment_provider_events',
        index: 'payment_provider_event_processing_idx',
        columns: ['organization_id', 'processed', 'received_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payment_provider_events',
        index: 'payment_provider_event_resource_idx',
        columns: ['provider', 'provider_resource_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payment_provider_events',
        index: 'payment_provider_events_organization_id_idx_1a5cd3f5',
        columns: ['organization_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payment_provider_events',
        index: 'payment_provider_events_organization_id_payment_id_idx_2d32040f',
        columns: ['organization_id', 'payment_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payments',
        index: 'payment_order_idx',
        columns: ['organization_id', 'order_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payments',
        index: 'payment_provider_payment_id_key_52208e71',
        columns: ['provider', 'provider_payment_id'],
        extras: { where: '"provider_payment_id" IS NOT NULL', unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'payments',
        index: 'payment_status_updated_idx',
        columns: ['organization_id', 'status', 'updated_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'payments',
        index: 'payments_organization_id_idx_1a5cd3f5',
        columns: ['organization_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'refunds',
        index: 'refund_actor_idx',
        columns: ['actor_user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'refunds',
        index: 'refund_provider_id_key_f334fafd',
        columns: ['organization_id', 'provider_refund_id'],
        extras: { where: '"provider_refund_id" IS NOT NULL', unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'refunds',
        index: 'refund_status_requested_idx',
        columns: ['organization_id', 'status', 'requested_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'refunds',
        index: 'refunds_organization_id_idx_1a5cd3f5',
        columns: ['organization_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'inventory_movements',
        foreignKey: {
          name: 'inventory_movement_reservation_fkey',
          columns: ['organization_id', 'reservation_id'],
          references: {
            schema: 'public',
            table: 'inventory_reservations',
            columns: ['organization_id', 'id'],
          },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payment_attempts',
        foreignKey: {
          name: 'payment_attempt_organization_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payment_attempts',
        foreignKey: {
          name: 'payment_attempt_payment_fkey',
          columns: ['organization_id', 'payment_id'],
          references: { schema: 'public', table: 'payments', columns: ['organization_id', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payment_provider_events',
        foreignKey: {
          name: 'payment_provider_event_organization_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payment_provider_events',
        foreignKey: {
          name: 'payment_provider_event_payment_fkey',
          columns: ['organization_id', 'payment_id'],
          references: { schema: 'public', table: 'payments', columns: ['organization_id', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payments',
        foreignKey: {
          name: 'payment_organization_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'payments',
        foreignKey: {
          name: 'payment_order_fkey',
          columns: ['organization_id', 'order_id'],
          references: { schema: 'public', table: 'orders', columns: ['organization_id', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'refunds',
        foreignKey: {
          name: 'refund_organization_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'refunds',
        foreignKey: {
          name: 'refund_payment_fkey',
          columns: ['organization_id', 'payment_id'],
          references: { schema: 'public', table: 'payments', columns: ['organization_id', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'refunds',
        foreignKey: {
          name: 'refund_actor_fkey',
          columns: ['actor_user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

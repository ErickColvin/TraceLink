#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/f1112244edcdccb2193887f4d89457033866f875e88fe2d1a6278ccbbcaeeccf/contract';
import endContract from '../../snapshots/f1112244edcdccb2193887f4d89457033866f875e88fe2d1a6278ccbbcaeeccf/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'audit_logs',
        columns: [
          col('action', 'character varying(160)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 160 } },
          }),
          col('actor_user_id', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('after_json', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('before_json', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('created_at', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('entity_id', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('entity_type', 'character varying(120)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 120 } },
          }),
          col('id', 'uuid', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/uuid@1' },
          }),
          col('organization_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('request_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'audit_log_identity_valid_317d46a4',
            'char_length(btrim("action")) > 0 AND char_length(btrim("entity_type")) > 0',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'categories',
        columns: [
          col('active', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('created_at', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/uuid@1' },
          }),
          col('image_url', 'character varying(2048)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 2048 } },
          }),
          col('name', 'character varying(140)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 140 } },
          }),
          col('organization_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('slug', 'character varying(100)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 100 } },
          }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'category_identity_valid_04da0bf4',
            '"slug" = lower(btrim("slug")) AND char_length(btrim("name")) > 0',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'customers',
        columns: [
          col('address_line_1', 'character varying(240)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 240 } },
          }),
          col('address_line_2', 'character varying(240)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 240 } },
          }),
          col('city', 'character varying(120)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 120 } },
          }),
          col('commune', 'character varying(120)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 120 } },
          }),
          col('created_at', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('email', 'character varying(320)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 320 } },
          }),
          col('email_normalized', 'character varying(320)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 320 } },
          }),
          col('first_name', 'character varying(100)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 100 } },
          }),
          col('id', 'uuid', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/uuid@1' },
          }),
          col('last_name', 'character varying(100)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 100 } },
          }),
          col('organization_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('phone', 'character varying(40)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 40 } },
          }),
          col('region', 'character varying(120)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 120 } },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('tax_id', 'character varying(40)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 40 } },
          }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('user_id', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'customer_identity_valid_f6cd14c1',
            'char_length(btrim("first_name")) > 0 AND char_length(btrim("last_name")) > 0 AND "email_normalized" = lower(btrim("email_normalized"))',
          ),
          checkExpression(
            'customers_status_check_ee520df2',
            "\"status\" IN ('ACTIVE', 'INACTIVE')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'idempotency_records',
        columns: [
          col('actor_user_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('created_at', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('expires_at', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'uuid', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/uuid@1' },
          }),
          col('key_hash', 'bytea', { notNull: true, codecRef: { codecId: 'pg/bytea@1' } }),
          col('operation', 'character varying(160)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 160 } },
          }),
          col('organization_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('original_request_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('request_hash', 'bytea', { notNull: true, codecRef: { codecId: 'pg/bytea@1' } }),
          col('resource_id', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('resource_type', 'character varying(120)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 120 } },
          }),
          col('response_json', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('response_status', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('IN_PROGRESS'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'idempotency_record_state_valid_f259233a',
            'octet_length("key_hash") = 32 AND octet_length("request_hash") = 32 AND "expires_at" > "created_at" AND (("status" = \'IN_PROGRESS\' AND "response_status" IS NULL AND "response_json" IS NULL) OR ("status" = \'COMPLETED\' AND "response_status" BETWEEN 200 AND 599 AND "response_json" IS NOT NULL))',
          ),
          checkExpression(
            'idempotency_records_status_check_d33d8563',
            "\"status\" IN ('IN_PROGRESS', 'COMPLETED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'inventory_balances',
        columns: [
          col('id', 'uuid', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/uuid@1' },
          }),
          col('location_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('lot_id', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('organization_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('physical_quantity', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('product_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('reserved_quantity', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'inventory_balance_quantities_valid_9a742e1c',
            '"physical_quantity" >= 0 AND "reserved_quantity" >= 0 AND "reserved_quantity" <= "physical_quantity"',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'inventory_locations',
        columns: [
          col('active', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('code', 'character varying(80)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 80 } },
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
          col('name', 'character varying(160)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 160 } },
          }),
          col('organization_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'inventory_location_identity_valid_ec05107c',
            'char_length(btrim("name")) > 0 AND char_length(btrim("code")) > 0',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'inventory_lots',
        columns: [
          col('created_at', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('expiration_date', 'date', { codecRef: { codecId: 'pg/date-temporal@1' } }),
          col('id', 'uuid', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/uuid@1' },
          }),
          col('lot_number', 'character varying(120)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 120 } },
          }),
          col('organization_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('product_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'inventory_lot_number_valid_9da413c9',
            'char_length(btrim("lot_number")) > 0',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'inventory_movements',
        columns: [
          col('actor_user_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('balance_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
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
          col('location_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('lot_id', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('new_physical_quantity', 'int4', {
            notNull: true,
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('organization_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('previous_physical_quantity', 'int4', {
            notNull: true,
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('product_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('quantity_delta', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('reason', 'character varying(240)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 240 } },
          }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'inventory_movement_quantities_valid_c6f6647e',
            '"quantity_delta" <> 0 AND "previous_physical_quantity" >= 0 AND "new_physical_quantity" >= 0 AND "new_physical_quantity" = "previous_physical_quantity" + "quantity_delta"',
          ),
          checkExpression(
            'inventory_movements_type_check_4666765d',
            "\"type\" IN ('PURCHASE_RECEIPT', 'SALE', 'ADJUSTMENT', 'RETURN', 'DAMAGE', 'EXPIRED', 'TRANSFER_IN', 'TRANSFER_OUT')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'inventory_reservations',
        columns: [
          col('created_at', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('expires_at', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'uuid', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/uuid@1' },
          }),
          col('location_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('lot_id', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('order_id', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('organization_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('product_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('quantity', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
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
            'inventory_reservation_values_valid_02fd4e0e',
            '"quantity" > 0 AND "expires_at" > "created_at"',
          ),
          checkExpression(
            'inventory_reservations_status_check_e4d0c47e',
            "\"status\" IN ('ACTIVE', 'CONSUMED', 'RELEASED', 'EXPIRED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'memberships',
        columns: [
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
          col('role_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('user_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'memberships_status_check_ee520df2',
            "\"status\" IN ('ACTIVE', 'INACTIVE')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'order_items',
        columns: [
          col('id', 'uuid', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/uuid@1' },
          }),
          col('line_total', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('order_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('organization_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('product_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('product_name_snapshot', 'character varying(200)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 200 } },
          }),
          col('quantity', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('sku_snapshot', 'character varying(100)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 100 } },
          }),
          col('unit_price', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'order_item_amounts_valid_14a13d1e',
            '"unit_price" >= 0 AND "quantity" > 0 AND "line_total" = "unit_price" * "quantity"',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'order_status_events',
        columns: [
          col('actor_user_id', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('from_status', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/uuid@1' },
          }),
          col('occurred_at', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('order_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('organization_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('reason', 'character varying(500)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 500 } },
          }),
          col('to_status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'order_status_event_transition_valid_ba42e96a',
            '"from_status" IS NULL OR "from_status" <> "to_status"',
          ),
          checkExpression(
            'order_status_events_from_status_check_e7581e6b',
            "\"from_status\" IN ('PENDING_PAYMENT', 'PAID', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED', 'REFUNDED')",
          ),
          checkExpression(
            'order_status_events_to_status_check_66c24f4b',
            "\"to_status\" IN ('PENDING_PAYMENT', 'PAID', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED', 'REFUNDED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'orders',
        columns: [
          col('completed_at', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('created_at', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('customer_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('discount', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('estimated_ready_at', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('fulfillment_type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/uuid@1' },
          }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('order_number', 'character varying(80)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 80 } },
          }),
          col('organization_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('payment_status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('shipping', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING_PAYMENT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('subtotal', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('total', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'order_amounts_valid_1e7b8002',
            '"subtotal" >= 0 AND "discount" >= 0 AND "shipping" >= 0 AND "discount" <= "subtotal" AND "total" = "subtotal" - "discount" + "shipping"',
          ),
          checkExpression(
            'orders_fulfillment_type_check_53d49a0e',
            "\"fulfillment_type\" IN ('PICKUP', 'DELIVERY')",
          ),
          checkExpression(
            'orders_payment_status_check_c585b9b6',
            "\"payment_status\" IN ('PENDING', 'PAID', 'REFUNDED')",
          ),
          checkExpression(
            'orders_status_check_ed5ae3a5',
            "\"status\" IN ('PENDING_PAYMENT', 'PAID', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED', 'REFUNDED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'organization_settings',
        columns: [
          col('contact_email', 'character varying(320)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 320 } },
          }),
          col('contact_phone', 'character varying(40)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 40 } },
          }),
          col('created_at', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('expiration_warning_days', 'int4', {
            notNull: true,
            default: lit(30),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('low_stock_threshold', 'int4', {
            notNull: true,
            default: lit(5),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('organization_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('package_alert_days', 'int4', {
            notNull: true,
            default: lit(5),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('pickup_address', 'character varying(300)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 300 } },
          }),
          col('pickup_instructions', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [
          primaryKey(['organization_id']),
          checkExpression(
            'organization_settings_thresholds_valid_632a79df',
            '"low_stock_threshold" >= 0 AND "package_alert_days" >= 0 AND "expiration_warning_days" >= 0',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'organizations',
        columns: [
          col('active', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
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
          col('locale', 'character varying(20)', {
            notNull: true,
            default: lit('es-CL'),
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 20 } },
          }),
          col('name', 'character varying(160)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 160 } },
          }),
          col('slug', 'character varying(80)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 80 } },
          }),
          col('timezone', 'character varying(80)', {
            notNull: true,
            default: lit('America/Santiago'),
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 80 } },
          }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'organization_identity_valid_4075c65a',
            'char_length(btrim("name")) > 0 AND "slug" = lower(btrim("slug")) AND char_length("currency") = 3',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'package_pickup_receipts',
        columns: [
          col('delivered_at', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('delivered_by_user_id', 'uuid', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1' },
          }),
          col('id', 'uuid', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/uuid@1' },
          }),
          col('organization_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('package_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('pickup_code_verified', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('received_by', 'character varying(200)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 200 } },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'package_pickup_receipt_values_valid_5a3042a3',
            'char_length(btrim("received_by")) > 0 AND "pickup_code_verified"',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'packages',
        columns: [
          col('carrier', 'character varying(160)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 160 } },
          }),
          col('created_at', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('customer_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/uuid@1' },
          }),
          col('item_count', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('order_id', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('organization_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('picked_up_at', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('pickup_code_consumed_at', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('pickup_code_hash', 'bytea', { codecRef: { codecId: 'pg/bytea@1' } }),
          col('pickup_deadline', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('ready_at', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('received_at', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('received_by_user_id', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('requires_cold_storage', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('EXPECTED'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('storage_location_id', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('stored_at', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('tracking_code', 'character varying(160)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 160 } },
          }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('weight_kg', 'numeric', { codecRef: { codecId: 'pg/numeric@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'package_values_valid_0542a9ca',
            'char_length(btrim("tracking_code")) > 0 AND char_length(btrim("carrier")) > 0 AND "item_count" > 0 AND ("weight_kg" IS NULL OR "weight_kg" > 0) AND ("pickup_code_hash" IS NULL OR octet_length("pickup_code_hash") = 32)',
          ),
          checkExpression(
            'packages_status_check_d678021e',
            "\"status\" IN ('EXPECTED', 'RECEIVED', 'STORED', 'READY_FOR_PICKUP', 'PICKED_UP', 'RETURNED', 'LOST', 'INCIDENT')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'permissions',
        columns: [
          col('created_at', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('description', 'character varying(240)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 240 } },
          }),
          col('key', 'character varying(120)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 120 } },
          }),
        ],
        constraints: [
          primaryKey(['key']),
          checkExpression(
            'permission_key_valid_9279437e',
            '"key" ~ \'^[a-z][a-z0-9_-]*\\.[a-z][a-z0-9_-]*$\'',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'products',
        columns: [
          col('active', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('barcode', 'character varying(100)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 100 } },
          }),
          col('brand', 'character varying(160)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 160 } },
          }),
          col('category_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('created_at', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('featured', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('id', 'uuid', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/uuid@1' },
          }),
          col('image_url', 'character varying(2048)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 2048 } },
          }),
          col('minimum_stock', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('name', 'character varying(200)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 200 } },
          }),
          col('organization_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('published', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('sale_price', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('sku', 'character varying(100)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 100 } },
          }),
          col('slug', 'character varying(160)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 160 } },
          }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'product_values_valid_f4c0e225',
            'char_length(btrim("sku")) > 0 AND "slug" = lower(btrim("slug")) AND char_length(btrim("name")) > 0 AND "sale_price" >= 0 AND "minimum_stock" >= 0',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'rate_limit_buckets',
        columns: [
          col('blocked_until', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('count', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('expires_at', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'uuid', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/uuid@1' },
          }),
          col('key_hash', 'bytea', { notNull: true, codecRef: { codecId: 'pg/bytea@1' } }),
          col('scope', 'character varying(120)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 120 } },
          }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('window_started_at', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'rate_limit_bucket_values_valid_a963acaf',
            'char_length(btrim("scope")) > 0 AND octet_length("key_hash") = 32 AND "count" >= 0 AND "expires_at" >= "window_started_at"',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'role_permissions',
        columns: [
          col('created_at', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('organization_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('permission_key', 'character varying(120)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 120 } },
          }),
          col('role_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['organization_id', 'role_id', 'permission_key'], {
            name: 'role_permission_pkey',
          }),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'roles',
        columns: [
          col('code', 'character varying(80)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 80 } },
          }),
          col('created_at', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/uuid@1' },
          }),
          col('label', 'character varying(120)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 120 } },
          }),
          col('organization_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('system', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'role_identity_valid_4f14adb4',
            'char_length(btrim("code")) > 0 AND char_length(btrim("label")) > 0',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'sessions',
        columns: [
          col('audience', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('customer_id', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('expires_at', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'uuid', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/uuid@1' },
          }),
          col('last_seen_at', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('membership_id', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('organization_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('revocation_reason', 'character varying(160)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 160 } },
          }),
          col('revoked_at', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('token_hash', 'bytea', { notNull: true, codecRef: { codecId: 'pg/bytea@1' } }),
          col('user_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'session_context_valid_dc975831',
            'octet_length("token_hash") = 32 AND "expires_at" > "created_at" AND (("audience" = \'STAFF\' AND "membership_id" IS NOT NULL AND "customer_id" IS NULL) OR ("audience" = \'CUSTOMER\' AND "customer_id" IS NOT NULL AND "membership_id" IS NULL))',
          ),
          checkExpression(
            'sessions_audience_check_de2a3de6',
            "\"audience\" IN ('CUSTOMER', 'STAFF')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'tracking_events',
        columns: [
          col('actor_user_id', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('description', 'character varying(500)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 500 } },
          }),
          col('id', 'uuid', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/uuid@1' },
          }),
          col('location', 'character varying(240)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 240 } },
          }),
          col('new_status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('occurred_at', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('organization_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('package_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('previous_status', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'tracking_event_values_valid_f46d30bb',
            'char_length(btrim("description")) > 0 AND ("previous_status" IS NULL OR "previous_status" <> "new_status")',
          ),
          checkExpression(
            'tracking_events_new_status_check_3a705eef',
            "\"new_status\" IN ('EXPECTED', 'RECEIVED', 'STORED', 'READY_FOR_PICKUP', 'PICKED_UP', 'RETURNED', 'LOST', 'INCIDENT')",
          ),
          checkExpression(
            'tracking_events_previous_status_check_a1498358',
            "\"previous_status\" IN ('EXPECTED', 'RECEIVED', 'STORED', 'READY_FOR_PICKUP', 'PICKED_UP', 'RETURNED', 'LOST', 'INCIDENT')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'users',
        columns: [
          col('created_at', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('email', 'character varying(320)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 320 } },
          }),
          col('email_normalized', 'character varying(320)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 320 } },
          }),
          col('email_verified_at', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'uuid', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/uuid@1' },
          }),
          col('password_hash', 'character varying(512)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 512 } },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
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
            'user_identity_valid_962ac172',
            '"email_normalized" = lower(btrim("email_normalized")) AND char_length("password_hash") > 0',
          ),
          checkExpression('users_status_check_ee520df2', "\"status\" IN ('ACTIVE', 'INACTIVE')"),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'audit_logs',
        constraint: 'audit_log_tenant_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'categories',
        constraint: 'category_tenant_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'categories',
        constraint: 'category_tenant_slug_key',
        columns: ['organization_id', 'slug'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'customers',
        constraint: 'customer_tenant_email_key',
        columns: ['organization_id', 'email_normalized'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'customers',
        constraint: 'customer_tenant_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'idempotency_records',
        constraint: 'idempotency_record_scope_key',
        columns: ['organization_id', 'actor_user_id', 'key_hash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'idempotency_records',
        constraint: 'idempotency_record_tenant_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'inventory_balances',
        constraint: 'inventory_balance_tenant_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'inventory_locations',
        constraint: 'inventory_location_tenant_code_key',
        columns: ['organization_id', 'code'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'inventory_locations',
        constraint: 'inventory_location_tenant_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'inventory_lots',
        constraint: 'inventory_lot_tenant_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'inventory_lots',
        constraint: 'inventory_lot_tenant_number_key',
        columns: ['organization_id', 'product_id', 'lot_number'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'inventory_lots',
        constraint: 'inventory_lot_tenant_product_id_key',
        columns: ['organization_id', 'product_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'inventory_movements',
        constraint: 'inventory_movement_tenant_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'inventory_reservations',
        constraint: 'inventory_reservation_tenant_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'memberships',
        constraint: 'membership_tenant_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'memberships',
        constraint: 'membership_tenant_user_key',
        columns: ['organization_id', 'user_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'order_items',
        constraint: 'order_item_tenant_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'order_status_events',
        constraint: 'order_status_event_tenant_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'orders',
        constraint: 'order_tenant_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'orders',
        constraint: 'order_tenant_number_key',
        columns: ['organization_id', 'order_number'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'organizations',
        constraint: 'organization_slug_key',
        columns: ['slug'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'package_pickup_receipts',
        constraint: 'package_pickup_receipt_package_key',
        columns: ['organization_id', 'package_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'package_pickup_receipts',
        constraint: 'package_pickup_receipt_tenant_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'packages',
        constraint: 'package_tenant_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'packages',
        constraint: 'package_tenant_tracking_key',
        columns: ['organization_id', 'tracking_code'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'products',
        constraint: 'product_tenant_barcode_key',
        columns: ['organization_id', 'barcode'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'products',
        constraint: 'product_tenant_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'products',
        constraint: 'product_tenant_sku_key',
        columns: ['organization_id', 'sku'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'products',
        constraint: 'product_tenant_slug_key',
        columns: ['organization_id', 'slug'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'rate_limit_buckets',
        constraint: 'rate_limit_bucket_scope_key',
        columns: ['scope', 'key_hash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'roles',
        constraint: 'role_tenant_code_key',
        columns: ['organization_id', 'code'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'roles',
        constraint: 'role_tenant_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'sessions',
        constraint: 'session_token_hash_key',
        columns: ['token_hash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'tracking_events',
        constraint: 'tracking_event_tenant_id_key',
        columns: ['organization_id', 'id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'users',
        constraint: 'user_email_normalized_key',
        columns: ['email_normalized'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'audit_logs',
        index: 'audit_log_entity_created_idx',
        columns: ['organization_id', 'entity_type', 'entity_id', 'created_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'audit_logs',
        index: 'audit_log_request_idx',
        columns: ['request_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'audit_logs',
        index: 'audit_log_tenant_created_idx',
        columns: ['organization_id', 'created_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'audit_logs',
        index: 'audit_logs_actor_user_id_idx_c46ca325',
        columns: ['actor_user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'audit_logs',
        index: 'audit_logs_organization_id_idx_1a5cd3f5',
        columns: ['organization_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'categories',
        index: 'categories_organization_id_idx_1a5cd3f5',
        columns: ['organization_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'categories',
        index: 'category_tenant_active_idx',
        columns: ['organization_id', 'active'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'customers',
        index: 'customer_tenant_status_created_idx',
        columns: ['organization_id', 'status', 'created_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'customers',
        index: 'customer_user_idx',
        columns: ['user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'customers',
        index: 'customers_organization_id_idx_1a5cd3f5',
        columns: ['organization_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'idempotency_records',
        index: 'idempotency_record_expiry_idx',
        columns: ['expires_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'idempotency_records',
        index: 'idempotency_record_resource_idx',
        columns: ['organization_id', 'resource_type', 'resource_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'idempotency_records',
        index: 'idempotency_records_actor_user_id_idx_c46ca325',
        columns: ['actor_user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'idempotency_records',
        index: 'idempotency_records_organization_id_idx_1a5cd3f5',
        columns: ['organization_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventory_balances',
        index: 'inventory_balance_lot_key_f906e74e',
        columns: ['organization_id', 'product_id', 'location_id', 'lot_id'],
        extras: { where: '"lot_id" IS NOT NULL', unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventory_balances',
        index: 'inventory_balance_no_lot_key_da3f026b',
        columns: ['organization_id', 'product_id', 'location_id'],
        extras: { where: '"lot_id" IS NULL', unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventory_balances',
        index: 'inventory_balances_organization_id_idx_1a5cd3f5',
        columns: ['organization_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventory_balances',
        index: 'inventory_balances_organization_id_location_id_idx_c5639cbc',
        columns: ['organization_id', 'location_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventory_balances',
        index: 'inventory_balances_organization_id_product_id_idx_b9c9cda1',
        columns: ['organization_id', 'product_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventory_balances',
        index: 'inventory_balances_organization_id_product_id_lot_id_i_fe2c3864',
        columns: ['organization_id', 'product_id', 'lot_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventory_locations',
        index: 'inventory_location_active_idx',
        columns: ['organization_id', 'active'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventory_locations',
        index: 'inventory_locations_organization_id_idx_1a5cd3f5',
        columns: ['organization_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventory_lots',
        index: 'inventory_lot_expiration_idx',
        columns: ['organization_id', 'product_id', 'expiration_date'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventory_lots',
        index: 'inventory_lots_organization_id_idx_1a5cd3f5',
        columns: ['organization_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventory_lots',
        index: 'inventory_lots_organization_id_product_id_idx_b9c9cda1',
        columns: ['organization_id', 'product_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventory_movements',
        index: 'inventory_movement_balance_created_idx',
        columns: ['organization_id', 'balance_id', 'created_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventory_movements',
        index: 'inventory_movement_product_created_idx',
        columns: ['organization_id', 'product_id', 'created_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventory_movements',
        index: 'inventory_movement_type_created_idx',
        columns: ['organization_id', 'type', 'created_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventory_movements',
        index: 'inventory_movements_actor_user_id_idx_c46ca325',
        columns: ['actor_user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventory_movements',
        index: 'inventory_movements_organization_id_balance_id_idx_542253d9',
        columns: ['organization_id', 'balance_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventory_movements',
        index: 'inventory_movements_organization_id_idx_1a5cd3f5',
        columns: ['organization_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventory_movements',
        index: 'inventory_movements_organization_id_location_id_idx_c5639cbc',
        columns: ['organization_id', 'location_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventory_movements',
        index: 'inventory_movements_organization_id_product_id_idx_b9c9cda1',
        columns: ['organization_id', 'product_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventory_movements',
        index: 'inventory_movements_organization_id_product_id_lot_id__fe2c3864',
        columns: ['organization_id', 'product_id', 'lot_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventory_reservations',
        index: 'inventory_reservation_expiry_idx',
        columns: ['organization_id', 'status', 'expires_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventory_reservations',
        index: 'inventory_reservation_order_idx',
        columns: ['organization_id', 'order_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventory_reservations',
        index: 'inventory_reservation_stock_idx',
        columns: ['organization_id', 'product_id', 'location_id', 'lot_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventory_reservations',
        index: 'inventory_reservations_organization_id_idx_1a5cd3f5',
        columns: ['organization_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventory_reservations',
        index: 'inventory_reservations_organization_id_location_id_idx_c5639cbc',
        columns: ['organization_id', 'location_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventory_reservations',
        index: 'inventory_reservations_organization_id_product_id_idx_b9c9cda1',
        columns: ['organization_id', 'product_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventory_reservations',
        index: 'inventory_reservations_organization_id_product_id_lot__fe2c3864',
        columns: ['organization_id', 'product_id', 'lot_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'memberships',
        index: 'membership_tenant_status_idx',
        columns: ['organization_id', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'memberships',
        index: 'membership_user_status_idx',
        columns: ['user_id', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'memberships',
        index: 'memberships_organization_id_idx_1a5cd3f5',
        columns: ['organization_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'memberships',
        index: 'memberships_organization_id_role_id_idx_41a463f8',
        columns: ['organization_id', 'role_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'memberships',
        index: 'memberships_user_id_idx_6c952402',
        columns: ['user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'order_items',
        index: 'order_item_order_idx',
        columns: ['organization_id', 'order_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'order_items',
        index: 'order_item_product_idx',
        columns: ['organization_id', 'product_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'order_items',
        index: 'order_items_organization_id_idx_1a5cd3f5',
        columns: ['organization_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'order_status_events',
        index: 'order_status_event_order_time_idx',
        columns: ['organization_id', 'order_id', 'occurred_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'order_status_events',
        index: 'order_status_events_actor_user_id_idx_c46ca325',
        columns: ['actor_user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'order_status_events',
        index: 'order_status_events_organization_id_idx_1a5cd3f5',
        columns: ['organization_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'order_status_events',
        index: 'order_status_events_organization_id_order_id_idx_8e1fee20',
        columns: ['organization_id', 'order_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'orders',
        index: 'order_customer_created_idx',
        columns: ['organization_id', 'customer_id', 'created_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'orders',
        index: 'order_payment_created_idx',
        columns: ['organization_id', 'payment_status', 'created_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'orders',
        index: 'order_status_created_idx',
        columns: ['organization_id', 'status', 'created_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'orders',
        index: 'orders_organization_id_customer_id_idx_b3ce292d',
        columns: ['organization_id', 'customer_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'orders',
        index: 'orders_organization_id_idx_1a5cd3f5',
        columns: ['organization_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'package_pickup_receipts',
        index: 'package_pickup_receipt_time_idx',
        columns: ['organization_id', 'delivered_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'package_pickup_receipts',
        index: 'package_pickup_receipts_delivered_by_user_id_idx_38913c7a',
        columns: ['delivered_by_user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'package_pickup_receipts',
        index: 'package_pickup_receipts_organization_id_idx_1a5cd3f5',
        columns: ['organization_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'packages',
        index: 'package_customer_created_idx',
        columns: ['organization_id', 'customer_id', 'created_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'packages',
        index: 'package_location_status_idx',
        columns: ['organization_id', 'storage_location_id', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'packages',
        index: 'package_status_created_idx',
        columns: ['organization_id', 'status', 'created_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'packages',
        index: 'packages_organization_id_customer_id_idx_b3ce292d',
        columns: ['organization_id', 'customer_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'packages',
        index: 'packages_organization_id_idx_1a5cd3f5',
        columns: ['organization_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'packages',
        index: 'packages_organization_id_order_id_idx_8e1fee20',
        columns: ['organization_id', 'order_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'packages',
        index: 'packages_organization_id_storage_location_id_idx_890ac01c',
        columns: ['organization_id', 'storage_location_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'packages',
        index: 'packages_received_by_user_id_idx_ec2b0e43',
        columns: ['received_by_user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'products',
        index: 'product_catalog_idx',
        columns: ['organization_id', 'category_id', 'active', 'published'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'products',
        index: 'product_tenant_created_idx',
        columns: ['organization_id', 'created_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'products',
        index: 'products_organization_id_category_id_idx_b3964fb6',
        columns: ['organization_id', 'category_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'products',
        index: 'products_organization_id_idx_1a5cd3f5',
        columns: ['organization_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'rate_limit_buckets',
        index: 'rate_limit_bucket_expiry_idx',
        columns: ['expires_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'role_permissions',
        index: 'role_permission_permission_idx',
        columns: ['permission_key'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'role_permissions',
        index: 'role_permissions_organization_id_role_id_idx_41a463f8',
        columns: ['organization_id', 'role_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'roles',
        index: 'role_organization_idx',
        columns: ['organization_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'sessions',
        index: 'session_tenant_audience_idx',
        columns: ['organization_id', 'audience', 'expires_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'sessions',
        index: 'session_user_validity_idx',
        columns: ['user_id', 'revoked_at', 'expires_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'sessions',
        index: 'sessions_organization_id_customer_id_idx_b3ce292d',
        columns: ['organization_id', 'customer_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'sessions',
        index: 'sessions_organization_id_idx_1a5cd3f5',
        columns: ['organization_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'sessions',
        index: 'sessions_organization_id_membership_id_idx_9bf738d3',
        columns: ['organization_id', 'membership_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'sessions',
        index: 'sessions_user_id_idx_6c952402',
        columns: ['user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'tracking_events',
        index: 'tracking_event_package_time_idx',
        columns: ['organization_id', 'package_id', 'occurred_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'tracking_events',
        index: 'tracking_events_actor_user_id_idx_c46ca325',
        columns: ['actor_user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'tracking_events',
        index: 'tracking_events_organization_id_idx_1a5cd3f5',
        columns: ['organization_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'tracking_events',
        index: 'tracking_events_organization_id_package_id_idx_721157a1',
        columns: ['organization_id', 'package_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'users',
        index: 'user_status_idx',
        columns: ['status'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'audit_logs',
        foreignKey: {
          name: 'audit_log_organization_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'audit_logs',
        foreignKey: {
          name: 'audit_log_actor_fkey',
          columns: ['actor_user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'categories',
        foreignKey: {
          name: 'category_organization_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'customers',
        foreignKey: {
          name: 'customer_organization_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'customers',
        foreignKey: {
          name: 'customer_user_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'idempotency_records',
        foreignKey: {
          name: 'idempotency_record_organization_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'idempotency_records',
        foreignKey: {
          name: 'idempotency_record_actor_fkey',
          columns: ['actor_user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'inventory_balances',
        foreignKey: {
          name: 'inventory_balance_organization_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'inventory_balances',
        foreignKey: {
          name: 'inventory_balance_product_fkey',
          columns: ['organization_id', 'product_id'],
          references: { schema: 'public', table: 'products', columns: ['organization_id', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'inventory_balances',
        foreignKey: {
          name: 'inventory_balance_location_fkey',
          columns: ['organization_id', 'location_id'],
          references: {
            schema: 'public',
            table: 'inventory_locations',
            columns: ['organization_id', 'id'],
          },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'inventory_balances',
        foreignKey: {
          name: 'inventory_balance_lot_fkey',
          columns: ['organization_id', 'product_id', 'lot_id'],
          references: {
            schema: 'public',
            table: 'inventory_lots',
            columns: ['organization_id', 'product_id', 'id'],
          },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'inventory_locations',
        foreignKey: {
          name: 'inventory_location_organization_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'inventory_lots',
        foreignKey: {
          name: 'inventory_lot_organization_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'inventory_lots',
        foreignKey: {
          name: 'inventory_lot_product_fkey',
          columns: ['organization_id', 'product_id'],
          references: { schema: 'public', table: 'products', columns: ['organization_id', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'inventory_movements',
        foreignKey: {
          name: 'inventory_movement_organization_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'inventory_movements',
        foreignKey: {
          name: 'inventory_movement_balance_fkey',
          columns: ['organization_id', 'balance_id'],
          references: {
            schema: 'public',
            table: 'inventory_balances',
            columns: ['organization_id', 'id'],
          },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'inventory_movements',
        foreignKey: {
          name: 'inventory_movement_product_fkey',
          columns: ['organization_id', 'product_id'],
          references: { schema: 'public', table: 'products', columns: ['organization_id', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'inventory_movements',
        foreignKey: {
          name: 'inventory_movement_location_fkey',
          columns: ['organization_id', 'location_id'],
          references: {
            schema: 'public',
            table: 'inventory_locations',
            columns: ['organization_id', 'id'],
          },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'inventory_movements',
        foreignKey: {
          name: 'inventory_movement_lot_fkey',
          columns: ['organization_id', 'product_id', 'lot_id'],
          references: {
            schema: 'public',
            table: 'inventory_lots',
            columns: ['organization_id', 'product_id', 'id'],
          },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'inventory_movements',
        foreignKey: {
          name: 'inventory_movement_actor_fkey',
          columns: ['actor_user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'inventory_reservations',
        foreignKey: {
          name: 'inventory_reservation_organization_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'inventory_reservations',
        foreignKey: {
          name: 'inventory_reservation_order_fkey',
          columns: ['organization_id', 'order_id'],
          references: { schema: 'public', table: 'orders', columns: ['organization_id', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'inventory_reservations',
        foreignKey: {
          name: 'inventory_reservation_product_fkey',
          columns: ['organization_id', 'product_id'],
          references: { schema: 'public', table: 'products', columns: ['organization_id', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'inventory_reservations',
        foreignKey: {
          name: 'inventory_reservation_location_fkey',
          columns: ['organization_id', 'location_id'],
          references: {
            schema: 'public',
            table: 'inventory_locations',
            columns: ['organization_id', 'id'],
          },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'inventory_reservations',
        foreignKey: {
          name: 'inventory_reservation_lot_fkey',
          columns: ['organization_id', 'product_id', 'lot_id'],
          references: {
            schema: 'public',
            table: 'inventory_lots',
            columns: ['organization_id', 'product_id', 'id'],
          },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'memberships',
        foreignKey: {
          name: 'membership_organization_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'memberships',
        foreignKey: {
          name: 'membership_user_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'memberships',
        foreignKey: {
          name: 'membership_role_fkey',
          columns: ['organization_id', 'role_id'],
          references: { schema: 'public', table: 'roles', columns: ['organization_id', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'order_items',
        foreignKey: {
          name: 'order_item_organization_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'order_items',
        foreignKey: {
          name: 'order_item_order_fkey',
          columns: ['organization_id', 'order_id'],
          references: { schema: 'public', table: 'orders', columns: ['organization_id', 'id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'order_items',
        foreignKey: {
          name: 'order_item_product_fkey',
          columns: ['organization_id', 'product_id'],
          references: { schema: 'public', table: 'products', columns: ['organization_id', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'order_status_events',
        foreignKey: {
          name: 'order_status_event_organization_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'order_status_events',
        foreignKey: {
          name: 'order_status_event_order_fkey',
          columns: ['organization_id', 'order_id'],
          references: { schema: 'public', table: 'orders', columns: ['organization_id', 'id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'order_status_events',
        foreignKey: {
          name: 'order_status_event_actor_fkey',
          columns: ['actor_user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'orders',
        foreignKey: {
          name: 'order_organization_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'orders',
        foreignKey: {
          name: 'order_customer_fkey',
          columns: ['organization_id', 'customer_id'],
          references: { schema: 'public', table: 'customers', columns: ['organization_id', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'organization_settings',
        foreignKey: {
          name: 'organization_settings_organization_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'package_pickup_receipts',
        foreignKey: {
          name: 'package_pickup_receipt_organization_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'package_pickup_receipts',
        foreignKey: {
          name: 'package_pickup_receipt_package_fkey',
          columns: ['organization_id', 'package_id'],
          references: { schema: 'public', table: 'packages', columns: ['organization_id', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'package_pickup_receipts',
        foreignKey: {
          name: 'package_pickup_receipt_deliverer_fkey',
          columns: ['delivered_by_user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'packages',
        foreignKey: {
          name: 'package_organization_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'packages',
        foreignKey: {
          name: 'package_customer_fkey',
          columns: ['organization_id', 'customer_id'],
          references: { schema: 'public', table: 'customers', columns: ['organization_id', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'packages',
        foreignKey: {
          name: 'package_order_fkey',
          columns: ['organization_id', 'order_id'],
          references: { schema: 'public', table: 'orders', columns: ['organization_id', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'packages',
        foreignKey: {
          name: 'package_storage_location_fkey',
          columns: ['organization_id', 'storage_location_id'],
          references: {
            schema: 'public',
            table: 'inventory_locations',
            columns: ['organization_id', 'id'],
          },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'packages',
        foreignKey: {
          name: 'package_receiver_fkey',
          columns: ['received_by_user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'products',
        foreignKey: {
          name: 'product_organization_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'products',
        foreignKey: {
          name: 'product_category_fkey',
          columns: ['organization_id', 'category_id'],
          references: { schema: 'public', table: 'categories', columns: ['organization_id', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'role_permissions',
        foreignKey: {
          name: 'role_permission_role_fkey',
          columns: ['organization_id', 'role_id'],
          references: { schema: 'public', table: 'roles', columns: ['organization_id', 'id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'role_permissions',
        foreignKey: {
          name: 'role_permission_permission_fkey',
          columns: ['permission_key'],
          references: { schema: 'public', table: 'permissions', columns: ['key'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'roles',
        foreignKey: {
          name: 'role_organization_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'sessions',
        foreignKey: {
          name: 'session_organization_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'sessions',
        foreignKey: {
          name: 'session_user_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'sessions',
        foreignKey: {
          name: 'session_membership_fkey',
          columns: ['organization_id', 'membership_id'],
          references: {
            schema: 'public',
            table: 'memberships',
            columns: ['organization_id', 'id'],
          },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'sessions',
        foreignKey: {
          name: 'session_customer_fkey',
          columns: ['organization_id', 'customer_id'],
          references: { schema: 'public', table: 'customers', columns: ['organization_id', 'id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'tracking_events',
        foreignKey: {
          name: 'tracking_event_organization_fkey',
          columns: ['organization_id'],
          references: { schema: 'public', table: 'organizations', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'tracking_events',
        foreignKey: {
          name: 'tracking_event_package_fkey',
          columns: ['organization_id', 'package_id'],
          references: { schema: 'public', table: 'packages', columns: ['organization_id', 'id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'tracking_events',
        foreignKey: {
          name: 'tracking_event_actor_fkey',
          columns: ['actor_user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

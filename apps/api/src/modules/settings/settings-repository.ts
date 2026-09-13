import type {
  OrganizationSettings,
  OrganizationSettingsInput,
} from "@tracelink/contracts";
import { organizationSettingsSchema } from "@tracelink/contracts";

import type { PostgresDatabase, SqlExecutor } from "../../database/index.js";
import { writeAudit } from "../../shared/audit/audit.js";
import { AppError } from "../../shared/errors/app-error.js";

type SettingsRow = Readonly<{
  organizationName: string;
  locale: string;
  currency: string;
  timezone: string;
  contactEmail: string;
  contactPhone: string;
  pickupAddress: string;
  pickupInstructions: string;
  lowStockThreshold: number;
  packageAlertDays: number;
  expirationWarningDays: number;
  updatedAt: Date;
}>;

const SETTINGS_SELECT = `
  SELECT o.name AS "organizationName",
         o.locale,
         o.currency,
         o.timezone,
         COALESCE(s.contact_email, 'contacto@example.invalid') AS "contactEmail",
         COALESCE(s.contact_phone, '000000') AS "contactPhone",
         COALESCE(s.pickup_address, 'Por configurar') AS "pickupAddress",
         COALESCE(
           s.pickup_instructions,
           'Presenta tu confirmación al retirar.'
         ) AS "pickupInstructions",
         COALESCE(s.low_stock_threshold, 5)::integer AS "lowStockThreshold",
         COALESCE(s.package_alert_days, 5)::integer AS "packageAlertDays",
         COALESCE(s.expiration_warning_days, 30)::integer
           AS "expirationWarningDays",
         COALESCE(s.updated_at, o.updated_at) AS "updatedAt"
    FROM organizations o
    LEFT JOIN organization_settings s ON s.organization_id = o.id`;

function toSettings(row: SettingsRow): OrganizationSettings {
  return organizationSettingsSchema.parse({
    ...row,
    updatedAt: row.updatedAt.toISOString(),
  });
}

function organizationNotFound(): AppError {
  return new AppError({
    statusCode: 404,
    code: "NOT_FOUND",
    message: "No se encontró la configuración de la organización.",
  });
}

function fieldValidation(field: string, message: string): AppError {
  return new AppError({
    statusCode: 400,
    code: "VALIDATION_ERROR",
    message,
    fieldErrors: { [field]: [message] },
  });
}

export function validateOrganizationSettings(
  input: OrganizationSettingsInput,
): void {
  try {
    new Intl.DateTimeFormat("es-CL", { timeZone: input.timezone }).format();
  } catch {
    throw fieldValidation(
      "timezone",
      "La zona horaria debe ser un identificador IANA válido.",
    );
  }

  try {
    Intl.getCanonicalLocales(input.locale);
  } catch {
    throw fieldValidation("locale", "El locale indicado no es válido.");
  }

  if (!/^[A-Z]{3}$/.test(input.currency)) {
    throw fieldValidation(
      "currency",
      "La moneda debe usar un código ISO de tres letras.",
    );
  }

}

export class PostgresSettingsRepository {
  readonly #database: PostgresDatabase;

  constructor(database: PostgresDatabase) {
    this.#database = database;
  }

  get(organizationId: string): Promise<OrganizationSettings> {
    return this.#get(this.#database, organizationId);
  }

  update(options: Readonly<{
    organizationId: string;
    actorUserId: string;
    input: OrganizationSettingsInput;
    requestId: string;
  }>): Promise<OrganizationSettings> {
    validateOrganizationSettings(options.input);
    return this.#database.sqlTransaction(async (executor) => {
      await this.#lockOrganization(executor, options.organizationId);
      const before = await this.#get(executor, options.organizationId);

      await executor.query(
        `UPDATE organizations
            SET name = $2, locale = $3, currency = $4,
                timezone = $5, updated_at = now()
          WHERE id = $1`,
        [
          options.organizationId,
          options.input.organizationName,
          options.input.locale,
          options.input.currency,
          options.input.timezone,
        ],
      );
      await executor.query(
        `INSERT INTO organization_settings
           (organization_id, contact_email, contact_phone, pickup_address,
            pickup_instructions, low_stock_threshold, package_alert_days,
            expiration_warning_days, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
         ON CONFLICT (organization_id) DO UPDATE
           SET contact_email = EXCLUDED.contact_email,
               contact_phone = EXCLUDED.contact_phone,
               pickup_address = EXCLUDED.pickup_address,
               pickup_instructions = EXCLUDED.pickup_instructions,
               low_stock_threshold = EXCLUDED.low_stock_threshold,
               package_alert_days = EXCLUDED.package_alert_days,
               expiration_warning_days = EXCLUDED.expiration_warning_days,
               updated_at = now()`,
        [
          options.organizationId,
          options.input.contactEmail,
          options.input.contactPhone,
          options.input.pickupAddress,
          options.input.pickupInstructions,
          options.input.lowStockThreshold,
          options.input.packageAlertDays,
          options.input.expirationWarningDays,
        ],
      );

      const after = await this.#get(executor, options.organizationId);
      await writeAudit(executor, {
        organizationId: options.organizationId,
        actorUserId: options.actorUserId,
        action: "settings.update",
        entityType: "OrganizationSettings",
        entityId: options.organizationId,
        before,
        after,
        requestId: options.requestId,
      });
      return after;
    });
  }

  async #get(
    executor: SqlExecutor,
    organizationId: string,
  ): Promise<OrganizationSettings> {
    const result = await executor.query<SettingsRow>(
      `${SETTINGS_SELECT}
       WHERE o.id = $1
       LIMIT 1`,
      [organizationId],
    );
    const settings = result.rows[0];
    if (settings === undefined) throw organizationNotFound();
    return toSettings(settings);
  }

  async #lockOrganization(
    executor: SqlExecutor,
    organizationId: string,
  ): Promise<void> {
    const result = await executor.query<Readonly<{ id: string }>>(
      `SELECT id FROM organizations WHERE id = $1 FOR UPDATE`,
      [organizationId],
    );
    if (result.rows[0] === undefined) throw organizationNotFound();
  }
}

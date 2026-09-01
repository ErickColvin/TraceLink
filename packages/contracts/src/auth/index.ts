import { z } from "zod";

import {
  csrfTokenSchema,
  emailSchema,
  entityIdSchema,
  isoDateTimeSchema,
} from "../common/index.js";

export const PERMISSIONS = [
  "products.view",
  "products.create",
  "products.update",
  "products.delete",
  "inventory.view",
  "inventory.adjust",
  "orders.view",
  "orders.update",
  "orders.cancel",
  "packages.view",
  "packages.receive",
  "packages.update",
  "packages.deliver",
  "customers.view",
  "customers.update",
  "users.view",
  "users.manage",
  "reports.view",
  "settings.manage",
] as const;

export const ROLE_CODES = [
  "SUPER_ADMIN",
  "ADMIN",
  "INVENTORY",
  "OPERATIONS",
  "SALES",
  "WAREHOUSE",
] as const;

export const AUTH_AUDIENCES = ["customer", "staff"] as const;
export const MEMBERSHIP_STATUSES = ["ACTIVE", "DISABLED"] as const;

export const permissionSchema = z.enum(PERMISSIONS);
export const roleCodeSchema = z.enum(ROLE_CODES);
export const authAudienceSchema = z.enum(AUTH_AUDIENCES);
export const membershipStatusSchema = z.enum(MEMBERSHIP_STATUSES);

export const signInRequestSchema = z
  .object({
    audience: authAudienceSchema,
    email: emailSchema,
    password: z.string().min(1).max(128),
  })
  .strict();

export const registerRequestSchema = z
  .object({
    firstName: z.string().trim().min(2).max(80),
    lastName: z.string().trim().min(2).max(80),
    email: emailSchema,
    password: z.string().min(12).max(128),
    phone: z.string().trim().min(6).max(32).optional(),
  })
  .strict();

export const authUserSchema = z
  .object({
    id: entityIdSchema,
    email: emailSchema,
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
  })
  .strict();

export const authOrganizationSchema = z
  .object({
    id: entityIdSchema,
    slug: z.string().trim().min(1).max(100),
    name: z.string().trim().min(1).max(160),
  })
  .strict();

export const authCustomerReferenceSchema = z
  .object({ id: entityIdSchema })
  .strict();

export const authMembershipSchema = z
  .object({
    id: entityIdSchema,
    status: membershipStatusSchema,
  })
  .strict();

export const authRoleSchema = z
  .object({
    id: entityIdSchema,
    code: roleCodeSchema,
    name: z.string().trim().min(1).max(120),
  })
  .strict();

const authMeBaseShape = {
  user: authUserSchema,
  organization: authOrganizationSchema,
  authenticatedAt: isoDateTimeSchema,
} satisfies z.ZodRawShape;

export const customerAuthMeResponseSchema = z
  .object({
    ...authMeBaseShape,
    audience: z.literal("customer"),
    customer: authCustomerReferenceSchema,
    permissions: z.array(permissionSchema).length(0),
  })
  .strict();

export const staffAuthMeResponseSchema = z
  .object({
    ...authMeBaseShape,
    audience: z.literal("staff"),
    membership: authMembershipSchema,
    role: authRoleSchema,
    permissions: z.array(permissionSchema),
  })
  .strict();

export const authMeResponseSchema = z.discriminatedUnion("audience", [
  customerAuthMeResponseSchema,
  staffAuthMeResponseSchema,
]);

export const authSessionEnvelopeSchema = z
  .object({
    session: authMeResponseSchema,
    csrfToken: csrfTokenSchema,
  })
  .strict();

export type Permission = z.infer<typeof permissionSchema>;
export type RoleCode = z.infer<typeof roleCodeSchema>;
export type AuthAudience = z.infer<typeof authAudienceSchema>;
export type MembershipStatus = z.infer<typeof membershipStatusSchema>;
export type SignInRequest = z.infer<typeof signInRequestSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type AuthMeResponse = z.infer<typeof authMeResponseSchema>;
export type AuthSessionEnvelope = z.infer<typeof authSessionEnvelopeSchema>;

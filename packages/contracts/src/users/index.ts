import { z } from "zod";

import {
  emailSchema,
  entityIdSchema,
  isoDateTimeSchema,
} from "../common/index.js";
import {
  createPaginatedResponseSchema,
  pageSchema,
  pageSizeSchema,
} from "../pagination/index.js";

export const STAFF_USER_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export const staffUserStatusSchema = z.enum(STAFF_USER_STATUSES);

export const staffUserSchema = z
  .object({
    /** Membership id in the current organization, not the global User id. */
    id: entityIdSchema,
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email: emailSchema,
    status: staffUserStatusSchema,
    roleId: entityIdSchema,
    lastAccessAt: isoDateTimeSchema.optional(),
    createdAt: isoDateTimeSchema,
  })
  .strict();

export const staffUserListParamsSchema = z
  .object({
    search: z.string().trim().max(200).optional(),
    status: staffUserStatusSchema.optional(),
    roleId: entityIdSchema.optional(),
    page: pageSchema.optional(),
    pageSize: pageSizeSchema.optional(),
  })
  .strict();

export const updateStaffUserAccessRequestSchema = z
  .object({
    status: staffUserStatusSchema,
    roleId: entityIdSchema,
  })
  .strict();

export const staffUserIdParamsSchema = z
  .object({ id: entityIdSchema })
  .strict();
export const staffUserPageSchema = createPaginatedResponseSchema(staffUserSchema);

export type StaffUserStatus = z.infer<typeof staffUserStatusSchema>;
export type StaffUser = z.infer<typeof staffUserSchema>;
export type StaffUserListParams = z.infer<typeof staffUserListParamsSchema>;
export type UpdateStaffUserAccessRequest = z.infer<
  typeof updateStaffUserAccessRequestSchema
>;
export type StaffUserPage = z.infer<typeof staffUserPageSchema>;

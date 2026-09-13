import { z } from "zod";

import {
  permissionSchema,
  roleCodeSchema,
} from "../auth/index.js";
import { entityIdSchema } from "../common/index.js";

export const staffRoleDefinitionSchema = z
  .object({
    id: entityIdSchema,
    code: roleCodeSchema,
    label: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(1_000),
    permissions: z.array(permissionSchema),
    system: z.boolean(),
  })
  .strict();

export const updateRolePermissionsRequestSchema = z
  .object({
    permissions: z.array(permissionSchema),
  })
  .strict();

export const roleIdParamsSchema = z
  .object({ id: entityIdSchema })
  .strict();

export type StaffRoleDefinition = z.infer<typeof staffRoleDefinitionSchema>;
export type UpdateRolePermissionsRequest = z.infer<
  typeof updateRolePermissionsRequestSchema
>;

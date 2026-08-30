import type { StaffUser } from "../domain";

export const mockStaffUsers: readonly StaffUser[] = [
  { id: "staff-camila-torres", firstName: "Camila", lastName: "Torres", email: "camila.torres@example.cl", status: "ACTIVE", roleId: "role-super-admin", lastAccessAt: "2026-08-30T14:10:00.000Z", createdAt: "2026-01-08T12:00:00.000Z" },
  { id: "staff-matias-soto", firstName: "Matías", lastName: "Soto", email: "matias.soto@example.cl", status: "ACTIVE", roleId: "role-inventory", lastAccessAt: "2026-08-30T12:44:00.000Z", createdAt: "2026-02-18T15:30:00.000Z" },
  { id: "staff-daniela-munoz", firstName: "Daniela", lastName: "Muñoz", email: "daniela.munoz@example.cl", status: "ACTIVE", roleId: "role-operations", lastAccessAt: "2026-08-29T21:18:00.000Z", createdAt: "2026-03-04T11:20:00.000Z" },
  { id: "staff-tomas-ruiz", firstName: "Tomás", lastName: "Ruiz", email: "tomas.ruiz@example.cl", status: "ACTIVE", roleId: "role-warehouse", lastAccessAt: "2026-08-30T13:02:00.000Z", createdAt: "2026-04-12T09:10:00.000Z" },
  { id: "staff-isidora-pena", firstName: "Isidora", lastName: "Peña", email: "isidora.pena@example.cl", status: "ACTIVE", roleId: "role-sales", lastAccessAt: "2026-08-28T16:36:00.000Z", createdAt: "2026-05-03T14:45:00.000Z" },
  { id: "staff-ignacio-arias", firstName: "Ignacio", lastName: "Arias", email: "ignacio.arias@example.cl", status: "INACTIVE", roleId: "role-admin", createdAt: "2026-01-22T17:00:00.000Z" },
];

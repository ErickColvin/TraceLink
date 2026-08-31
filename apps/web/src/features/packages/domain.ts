export const PACKAGE_STATUSES = [
  "EXPECTED",
  "RECEIVED",
  "STORED",
  "READY_FOR_PICKUP",
  "PICKED_UP",
  "RETURNED",
  "LOST",
  "INCIDENT",
] as const;

export type PackageStatus = (typeof PACKAGE_STATUSES)[number];

export type TrackingEventFor<S extends PackageStatus> = {
  id: string;
  status: S;
  occurredAt: string;
  description: string;
  location?: string;
  recordedBy?: string;
};

export type TrackingEvent = {
  [Status in PackageStatus]: TrackingEventFor<Status>;
}[PackageStatus];

export interface PackageContents {
  description: string;
  itemCount: number;
  requiresColdStorage: boolean;
}

export interface CustomerPackage {
  id: string;
  trackingCode: string;
  customerId: string;
  orderId?: string;
  status: PackageStatus;
  contents: PackageContents;
  expectedAt?: string;
  receivedAt?: string;
  pickupDeadline?: string;
  storageLocation?: string;
  weightKg?: number;
  createdAt: string;
  updatedAt: string;
  events: TrackingEvent[];
}

export type Package = CustomerPackage;

export const PACKAGE_SORT_OPTIONS = ["NEWEST", "OLDEST", "STATUS"] as const;

export type PackageSort = (typeof PACKAGE_SORT_OPTIONS)[number];

export interface CurrentCustomerPackageListParams {
  search?: string;
  statuses?: PackageStatus[];
  sort?: PackageSort;
  page?: number;
  pageSize?: number;
}

export interface PackagePage {
  items: CustomerPackage[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export type StaffPackageCustomer = Readonly<{
  id: string;
  fullName: string;
  email: string;
  phone?: string;
}>;

export const PACKAGE_CARRIERS = [
  "Blue Express",
  "Chilexpress",
  "Starken",
  "CH Market",
] as const;

export type StaffTrackingEvent = TrackingEvent &
  Readonly<{
    previousStatus: PackageStatus | null;
    newStatus: PackageStatus;
    createdAt: string;
    actor: PackageActor;
    notes?: string;
  }>;

export type PackagePickupReceipt = Readonly<{
  receivedBy: string;
  pickupCodeVerified: true;
  deliveredAt: string;
  deliveredBy: string;
}>;

export interface StaffPackage extends Omit<CustomerPackage, "events"> {
  carrier: string;
  notes?: string;
  customer: StaffPackageCustomer;
  pickupReceipt?: PackagePickupReceipt;
  events: StaffTrackingEvent[];
}

export const STAFF_PACKAGE_SORT_OPTIONS = [
  "QUEUE",
  "NEWEST",
  "OLDEST",
  "STATUS",
] as const;

export type StaffPackageSort = (typeof STAFF_PACKAGE_SORT_OPTIONS)[number];

export interface StaffPackageListParams {
  search?: string;
  tracking?: string;
  customer?: string;
  carrier?: string;
  location?: string;
  statuses?: PackageStatus[];
  coldStorage?: boolean;
  sort?: StaffPackageSort;
  page?: number;
  pageSize?: number;
}

export interface StaffPackagePage {
  items: StaffPackage[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export type PackageActor = Readonly<{
  id: string;
  name: string;
}>;

export type ReceiveStaffPackageInput = Readonly<{
  trackingCode: string;
  carrier: string;
  customerId: string;
  orderId?: string;
  contents: PackageContents;
  storageLocation: string;
  notes?: string;
  expectedAt?: string;
  receivedAt?: string;
  weightKg?: number;
  actor: PackageActor;
}>;

export type TransitionStaffPackageInput = Readonly<{
  packageId: string;
  toStatus: PackageStatus;
  description?: string;
  location?: string;
  actor: PackageActor;
}>;

export type DeliverStaffPackageInput = Readonly<{
  packageId: string;
  pickupCode: string;
  receivedBy: string;
  actor: PackageActor;
}>;

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

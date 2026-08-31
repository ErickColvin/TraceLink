import type {
  CancelStaffOrderInput,
  StaffOrder,
  StaffOrderListParams,
  StaffOrderPage,
  TransitionStaffOrderInput,
} from "../domain";

export interface StaffOrderService {
  /** Lists the operational queue. This contract is never used by customer pages. */
  list(params?: StaffOrderListParams): Promise<StaffOrderPage>;
  /** Staff lookup is intentionally separate from the current-customer lookup. */
  getById(id: string): Promise<StaffOrder>;
  transitionStatus(input: TransitionStaffOrderInput): Promise<StaffOrder>;
  cancel(input: CancelStaffOrderInput): Promise<StaffOrder>;
}

export class StaffOrderNotFoundError extends Error {
  constructor(id: string) {
    super(`No se encontró el pedido operativo '${id}'.`);
    this.name = "StaffOrderNotFoundError";
  }
}

export class InvalidOrderTransitionError extends Error {
  constructor(fromStatus: string, toStatus: string) {
    super(`No se puede cambiar un pedido de ${fromStatus} a ${toStatus}.`);
    this.name = "InvalidOrderTransitionError";
  }
}

export class InvalidOrderCancellationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidOrderCancellationError";
  }
}

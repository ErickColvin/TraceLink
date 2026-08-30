/**
 * Identity bridge used only by the in-memory adapters. Real adapters will
 * resolve the authenticated subject on the server and will not accept a
 * customer id from UI code.
 */
export const DEMO_CUSTOMER_ID = "customer-valentina-rojas";

export interface CurrentCustomerResolver {
  requireCurrentCustomerId(): string;
}

export class MockSessionContext implements CurrentCustomerResolver {
  private currentCustomerId: string | null = null;

  setCurrentCustomer(customerId: string): void {
    this.currentCustomerId = customerId;
  }

  clear(): void {
    this.currentCustomerId = null;
  }

  requireCurrentCustomerId(): string {
    if (!this.currentCustomerId) {
      throw new Error("No hay un cliente autenticado en la sesión de demostración.");
    }

    return this.currentCustomerId;
  }
}

export const mockSessionContext = new MockSessionContext();

import { z } from "zod";
import type { CheckoutResponse } from "@tracelink/contracts";

const STORAGE_KEY = "tracelink.pending-checkout.v1";

const pendingCheckoutSchema = z.object({
  orderId: z.string().trim().min(1).max(160),
  reservationExpiresAt: z.iso.datetime(),
  storedAt: z.iso.datetime(),
}).strict();

export type PendingCheckout = z.infer<typeof pendingCheckoutSchema>;

function availableStorage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export function rememberPendingCheckout(
  checkout: Readonly<{
    order: Pick<CheckoutResponse["order"], "id">;
    reservationExpiresAt: CheckoutResponse["reservationExpiresAt"];
  }>,
): void {
  const storage = availableStorage();
  if (storage === null) return;

  storage.setItem(STORAGE_KEY, JSON.stringify({
    orderId: checkout.order.id,
    reservationExpiresAt: checkout.reservationExpiresAt,
    storedAt: new Date().toISOString(),
  } satisfies PendingCheckout));
}

export function readPendingCheckout(): PendingCheckout | null {
  const storage = availableStorage();
  if (storage === null) return null;

  const serialized = storage.getItem(STORAGE_KEY);
  if (serialized === null) return null;

  try {
    const parsed = pendingCheckoutSchema.safeParse(JSON.parse(serialized));
    if (parsed.success) return parsed.data;
  } catch {
    // Invalid browser state is discarded below.
  }

  storage.removeItem(STORAGE_KEY);
  return null;
}

export function clearPendingCheckout(): void {
  availableStorage()?.removeItem(STORAGE_KEY);
}

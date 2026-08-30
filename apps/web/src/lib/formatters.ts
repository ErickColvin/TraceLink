import { tenantBrand } from "@/app/config/brand";

const clpFormatter = new Intl.NumberFormat(tenantBrand.locale, {
  style: "currency",
  currency: tenantBrand.currency,
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat(tenantBrand.locale, {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: tenantBrand.timezone,
});

const dateTimeFormatter = new Intl.DateTimeFormat(tenantBrand.locale, {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: tenantBrand.timezone,
});

const compactDateFormatter = new Intl.DateTimeFormat(tenantBrand.locale, {
  day: "2-digit",
  month: "short",
  timeZone: tenantBrand.timezone,
});

const compactCalendarDateFormatter = new Intl.DateTimeFormat(
  tenantBrand.locale,
  {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  },
);

export function formatClp(value: number): string {
  return clpFormatter.format(Math.round(value));
}

export function formatDate(value: string | Date): string {
  return dateFormatter.format(new Date(value));
}

export function formatDateTime(value: string | Date): string {
  return dateTimeFormatter.format(new Date(value));
}

export function formatCompactDate(value: string | Date): string {
  return compactDateFormatter.format(new Date(value));
}

export function formatCompactCalendarDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new RangeError(`Fecha calendario inválida: ${value}`);
  }

  return compactCalendarDateFormatter.format(parsed);
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toLocaleUpperCase(
    tenantBrand.locale,
  );
}

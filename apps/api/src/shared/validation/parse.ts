import { z } from "zod";

import { AppError } from "../errors/app-error.js";

export type ValidationSource = "body" | "params" | "query" | "response";

type ValidationIssue = Readonly<{
  path: string;
  code: string;
  message: string;
}>;

export function parseWithSchema<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
  source: ValidationSource,
): z.output<Schema> {
  const result = schema.safeParse(input);

  if (result.success) {
    return result.data;
  }

  const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
    path: [source, ...issue.path.map(String)].join("."),
    code: issue.code,
    message: issue.message,
  }));

  throw new AppError({
    statusCode: source === "response" ? 502 : 400,
    code: source === "response" ? "INVALID_UPSTREAM_RESPONSE" : "VALIDATION_ERROR",
    message:
      source === "response"
        ? "La respuesta recibida no cumple el contrato esperado."
        : "La solicitud contiene datos inválidos.",
    fieldErrors: issues.reduce<Record<string, string[]>>((fieldErrors, issue) => {
      (fieldErrors[issue.path] ??= []).push(issue.message);
      return fieldErrors;
    }, {}),
  });
}

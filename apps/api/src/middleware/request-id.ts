import { randomUUID } from "node:crypto";

import type { RequestHandler, Response } from "express";

export const REQUEST_ID_HEADER = "X-Request-ID";
const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;

export function resolveRequestId(candidate: string | undefined): string {
  return candidate !== undefined && SAFE_REQUEST_ID.test(candidate)
    ? candidate
    : randomUUID();
}

export function getResponseRequestId(response: Response): string {
  const value = response.getHeader(REQUEST_ID_HEADER);
  return typeof value === "string" ? value : "unavailable";
}

export const requestIdMiddleware: RequestHandler = (
  request,
  response,
  next,
) => {
  const requestId = resolveRequestId(request.get("x-request-id"));
  response.setHeader(REQUEST_ID_HEADER, requestId);
  next();
};

import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors/app-error";

export function jsonSuccess<T>(data: T, status = 200, requestId?: string) {
  return NextResponse.json(
    { data, ...(requestId ? { requestId } : {}) },
    { status },
  );
}

export function jsonError(error: AppError, requestId?: string) {
  return NextResponse.json(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
      ...(requestId ? { requestId } : {}),
    },
    { status: error.status },
  );
}

export function handleRouteError(error: unknown, requestId?: string) {
  if (error instanceof AppError) {
    return jsonError(error, requestId);
  }

  if (error instanceof SyntaxError) {
    return jsonError(AppError.validation("Invalid JSON body"), requestId);
  }

  console.error("[api] unhandled error", error);
  return jsonError(AppError.internal(), requestId);
}

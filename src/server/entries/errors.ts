import type { ErrorCode, ApiError } from "../../contracts/index.ts";

export class EntryFault extends Error {
  readonly name = "EntryFault";
  readonly code: ErrorCode;
  readonly status: number;
  readonly fieldErrors: ApiError["fieldErrors"];
  constructor(code: ErrorCode, status: number, fieldErrors: ApiError["fieldErrors"] = []) {
    super(code);
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

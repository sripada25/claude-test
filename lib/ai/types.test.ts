import { describe, expect, it } from "vitest";
import { err, ok } from "./types.ts";

describe("ok", () => {
  it("produces a success result carrying the data", () => {
    expect(ok({ value: 42 })).toEqual({ success: true, data: { value: 42 } });
  });
});

describe("err", () => {
  it("produces a failure result carrying the error class and message", () => {
    expect(err("rate_limited", "too many requests")).toEqual({
      success: false,
      error: { errorClass: "rate_limited", message: "too many requests" },
    });
  });
});

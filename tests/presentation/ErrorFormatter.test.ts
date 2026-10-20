import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DomainError } from "../../src/domain/errors/DomainError.js";
import { ErrorFormatter } from "../../src/presentation/formatters/ErrorFormatter.js";

describe("ErrorFormatter", () => {
  const formatter = new ErrorFormatter();

  it("adds the error prefix without an error name or stack", () => {
    assert.equal(formatter.format(new DomainError("no such shape: r9")), "error: no such shape: r9");
  });

  it("keeps each error on one output line", () => {
    assert.equal(formatter.format(new Error("first\r\nsecond\nthird")), "error: first second third");
  });

  it("formats non-Error failures", () => {
    assert.equal(formatter.format("unexpected failure"), "error: unexpected failure");
  });

  it("supplies a message when an error is empty", () => {
    assert.equal(formatter.format(new Error("")), "error: unknown error");
  });
});

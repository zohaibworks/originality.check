import test from "node:test";
import assert from "node:assert/strict";

import { getAiProviderFailure } from "./aiDetection.ts";

test("classifies provider timeouts as retryable gateway timeouts", () => {
  const error = new Error("request timed out");
  error.name = "TimeoutError";

  assert.deepEqual(getAiProviderFailure(error), {
    status: 504,
    message: "AI detection provider timed out. Please try again. No score was generated.",
  });
});

test("classifies provider connection failures without exposing low-level details", () => {
  assert.deepEqual(
    getAiProviderFailure(new TypeError("fetch failed: ECONNREFUSED")),
    {
      status: 502,
      message: "Could not connect to the AI detection provider. Check the server's outbound network and try again. No score was generated.",
    }
  );
});

test("classifies unreadable provider payloads", () => {
  assert.deepEqual(
    getAiProviderFailure(new SyntaxError("Unexpected token")),
    {
      status: 502,
      message: "AI detection provider returned an unreadable response. No score was generated.",
    }
  );
});

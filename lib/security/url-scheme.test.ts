import { describe, expect, it } from "vitest";
import { isAllowedUrlScheme } from "./url-scheme.ts";

describe("isAllowedUrlScheme", () => {
  it("allows http and https", () => {
    expect(isAllowedUrlScheme("http://example.com/job/123")).toBe(true);
    expect(isAllowedUrlScheme("https://example.com/job/123")).toBe(true);
  });

  it("rejects javascript:, data:, file:, and vbscript:", () => {
    expect(isAllowedUrlScheme("javascript:alert(1)")).toBe(false);
    expect(isAllowedUrlScheme("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isAllowedUrlScheme("file:///etc/passwd")).toBe(false);
    expect(isAllowedUrlScheme("vbscript:msgbox(1)")).toBe(false);
  });

  it("rejects malformed URLs", () => {
    expect(isAllowedUrlScheme("not a url")).toBe(false);
    expect(isAllowedUrlScheme("")).toBe(false);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

const extractProfileMock = vi.fn();

vi.mock("../ai/provider.ts", () => ({
  getAIProvider: () => ({ extractProfile: extractProfileMock }),
}));

import { parseResume } from "./resume-parse.ts";

describe("parseResume", () => {
  afterEach(() => {
    extractProfileMock.mockReset();
  });

  it("calls extractProfile for a valid PDF under the size limit", async () => {
    extractProfileMock.mockResolvedValue({ success: true, data: { skills: [] } });

    const result = await parseResume({
      buffer: Buffer.from("pdf-bytes"),
      mimeType: "application/pdf",
    });

    expect(result).toEqual({ success: true, data: { skills: [] } });
    expect(extractProfileMock).toHaveBeenCalledWith(Buffer.from("pdf-bytes"));
  });

  it("rejects an oversized file without calling the provider", async () => {
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1);

    const result = await parseResume({ buffer: oversized, mimeType: "application/pdf" });

    expect(result).toEqual({
      success: false,
      error: { errorClass: "bad_request", message: expect.any(String) },
    });
    expect(extractProfileMock).not.toHaveBeenCalled();
  });

  it("rejects a non-PDF mime type without calling the provider", async () => {
    const result = await parseResume({
      buffer: Buffer.from("not a pdf"),
      mimeType: "image/png",
    });

    expect(result).toEqual({
      success: false,
      error: { errorClass: "bad_request", message: expect.any(String) },
    });
    expect(extractProfileMock).not.toHaveBeenCalled();
  });

  it("passes through a provider failure unchanged", async () => {
    extractProfileMock.mockResolvedValue({
      success: false,
      error: { errorClass: "safety_block", message: "blocked" },
    });

    const result = await parseResume({
      buffer: Buffer.from("pdf-bytes"),
      mimeType: "application/pdf",
    });

    expect(result).toEqual({
      success: false,
      error: { errorClass: "safety_block", message: "blocked" },
    });
  });
});

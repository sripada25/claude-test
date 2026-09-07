import { afterEach, describe, expect, it, vi } from "vitest";

const parseResumeMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/services/resume-parse", () => ({
  parseResume: parseResumeMock,
}));

import { POST } from "./route.ts";

describe("POST /api/profile/parse-resume", () => {
  afterEach(() => {
    parseResumeMock.mockReset();
  });

  function requestWithFile(params: {
    userId?: string | null;
    fileName?: string;
    fileType?: string;
    content?: string;
    noFile?: boolean;
  }): Request {
    const formData = new FormData();
    if (!params.noFile) {
      const file = new File([params.content ?? "pdf-bytes"], params.fileName ?? "resume.pdf", {
        type: params.fileType ?? "application/pdf",
      });
      formData.set("resume", file);
    }

    return new Request("http://localhost:3000/api/profile/parse-resume", {
      method: "POST",
      headers: params.userId ? { "x-user-id": params.userId } : {},
      body: formData,
    });
  }

  it("returns 401 without x-user-id", async () => {
    const response = await POST(requestWithFile({ userId: null }));
    expect(response.status).toBe(401);
    expect(parseResumeMock).not.toHaveBeenCalled();
  });

  it("returns 400 when no file is attached", async () => {
    const response = await POST(requestWithFile({ userId: "user-1", noFile: true }));
    expect(response.status).toBe(400);
    expect(parseResumeMock).not.toHaveBeenCalled();
  });

  it("on success, returns the extracted profile", async () => {
    parseResumeMock.mockResolvedValue({ success: true, data: { fullName: "Jane Doe" } });

    const response = await POST(requestWithFile({ userId: "user-1" }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true, data: { fullName: "Jane Doe" } });
  });

  it("on a bad_request failure, returns 400", async () => {
    parseResumeMock.mockResolvedValue({
      success: false,
      error: { errorClass: "bad_request", message: "Only PDF files are accepted." },
    });

    const response = await POST(requestWithFile({ userId: "user-1" }));

    expect(response.status).toBe(400);
  });

  it("on a non-bad_request failure (e.g. safety_block), returns 200 with the failure payload", async () => {
    parseResumeMock.mockResolvedValue({
      success: false,
      error: { errorClass: "safety_block", message: "blocked" },
    });

    const response = await POST(requestWithFile({ userId: "user-1" }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      success: false,
      error: { errorClass: "safety_block", message: "blocked" },
    });
  });
});

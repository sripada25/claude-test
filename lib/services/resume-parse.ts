import { getAIProvider } from "../ai/provider.ts";
import { err, type ExtractedProfile, type Result } from "../ai/types.ts";

const MAX_RESUME_BYTES = 10 * 1024 * 1024;

export async function parseResume(params: {
  buffer: Buffer;
  mimeType: string;
}): Promise<Result<ExtractedProfile>> {
  if (params.mimeType !== "application/pdf") {
    return err("bad_request", "Only PDF files are accepted.");
  }

  if (params.buffer.byteLength > MAX_RESUME_BYTES) {
    return err("bad_request", "File exceeds the 10 MB limit.");
  }

  return getAIProvider().extractProfile(params.buffer);
}

import {
  listDocumentsByApplication,
  updateDocumentContent as updateDocumentContentRepo,
  type GeneratedDocument,
} from "../repositories/documents.ts";
import { getApplication } from "./application.ts";

export type UpdateDocumentResult =
  | { success: true; document: GeneratedDocument }
  | { success: false; reason: "not_found" | "empty_content" };

// "The 'Edit' action on M06 - no AI call, no quota" (TASKS_quarterfinal.md
// F3-3.4). No AI-output validation (length bounds, injection markers,
// placeholder brackets) applies here - AI-RULES.md §2.3 frames those as
// "never save model output unchecked," which stops applying once a human
// has edited it. Only a basic non-empty check.
export async function updateDocumentContent(
  userId: string,
  documentId: string,
  content: string,
): Promise<UpdateDocumentResult> {
  if (content.trim() === "") {
    return { success: false, reason: "empty_content" };
  }

  const document = await updateDocumentContentRepo(documentId, userId, content);
  if (!document) {
    return { success: false, reason: "not_found" };
  }

  return { success: true, document };
}

export type ListDocumentsResult =
  | { success: true; documents: GeneratedDocument[] }
  | { success: false; reason: "not_found" };

// Populates M05's Documents tab. Ownership is enforced via the existing
// application lookup - a user can never list another user's documents by
// guessing an applicationId.
export async function listDocuments(userId: string, applicationId: string): Promise<ListDocumentsResult> {
  const application = await getApplication(userId, applicationId);
  if (!application) {
    return { success: false, reason: "not_found" };
  }

  const documents = await listDocumentsByApplication(applicationId);
  return { success: true, documents };
}

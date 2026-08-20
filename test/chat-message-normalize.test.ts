import assert from "node:assert/strict";
import test from "node:test";

import { textFromUnknown } from "../lib/chat-message-normalize";
import { downloadUrl, extractMediaPaths } from "../lib/chat-artifacts";

test("textFromUnknown safely flattens Hermes structured content blocks", () => {
  assert.equal(
    textFromUnknown([
      { type: "text", text: "The PDF is ready." },
      { type: "text", text: "MEDIA:/home/victor/.hermes/profiles/cust/report.pdf" },
    ]),
    "The PDF is ready.\nMEDIA:/home/victor/.hermes/profiles/cust/report.pdf",
  );
});

test("textFromUnknown never throws for tool-shaped objects", () => {
  assert.equal(textFromUnknown({ type: "tool_result", tool_use_id: "abc", result: { ok: true } }), "");
  assert.equal(textFromUnknown({ name: "create_document", arguments: { format: "pdf" } }), "");
});

test("downloadUrl requests inline content only for previews", () => {
  assert.equal(
    downloadUrl("/home/victor/.hermes/profiles/cust/report.pdf"),
    "/api/hermes/download?path=%2Fhome%2Fvictor%2F.hermes%2Fprofiles%2Fcust%2Freport.pdf",
  );
  assert.equal(
    downloadUrl("/home/victor/.hermes/profiles/cust/report.pdf", true),
    "/api/hermes/download?path=%2Fhome%2Fvictor%2F.hermes%2Fprofiles%2Fcust%2Freport.pdf&inline=1",
  );
});

test("extractMediaPaths removes Markdown wrappers from generated document paths", () => {
  assert.deepEqual(
    extractMediaPaths("Here is the file: MEDIA:`/tmp/report.pdf` and MEDIA:\"/tmp/notes.pdf\"."),
    ["/tmp/report.pdf", "/tmp/notes.pdf"],
  );
  assert.deepEqual(extractMediaPaths("MEDIA:/tmp/report.pdf`"), ["/tmp/report.pdf"]);
});

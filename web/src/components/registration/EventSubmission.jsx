"use client";

import { useState } from "react";
import { Download, Upload } from "lucide-react";
import { eventSubmissionObjectUrl, submitEventFile } from "@/api/client.js";

const ACCEPT = ".pdf,.ppt,.pptx,.doc,.docx";

/**
 * The "Upload File" control on a registration card, for events that accept a
 * presentation file. Only the team lead can upload; the stored object is named
 * by the registration id server-side, so re-uploading just replaces it.
 */
export default function EventSubmission({ registrationId, canUpload, filename: initial }) {
  const [filename, setFilename] = useState(initial || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file after an error
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const res = await submitEventFile(registrationId, file);
      setFilename(res.submission_filename || file.name);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    try {
      const url = await eventSubmissionObjectUrl(registrationId);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || registrationId;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  };

  if (!canUpload) {
    return (
      <p className="muted event-card__submission">
        {filename ? `Submission: ${filename}` : "Only the team lead can upload the submission."}
      </p>
    );
  }

  return (
    <div className="event-card__submission">
      <label className="btn btn-sm">
        <Upload size={13} aria-hidden="true" />
        {busy ? " Uploading…" : filename ? " Replace file" : " Upload File"}
        <input type="file" accept={ACCEPT} hidden disabled={busy} onChange={pick} />
      </label>
      {filename && !busy && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={download}>
          <Download size={13} aria-hidden="true" /> {filename}
        </button>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

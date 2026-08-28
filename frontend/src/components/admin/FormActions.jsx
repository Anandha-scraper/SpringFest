import { Check, X } from "lucide-react";

// Shared Save / Cancel pair for the admin edit forms. Sits at the end of a
// form and spans the full width of the .event-form / .filter-bar grid.
// Pass onCancel only when there's something to cancel (i.e. editing an
// existing record); omit it for a plain "add" form.
export default function FormActions({
  editing = false,
  saveLabel,
  cancelLabel = "Cancel",
  onCancel,
  disabled = false,
}) {
  return (
    <div className="form-actions">
      <button className="btn" type="submit" disabled={disabled}>
        <Check size={16} aria-hidden="true" />
        {saveLabel ?? (editing ? "Save changes" : "Save")}
      </button>
      {onCancel && (
        <button className="btn btn-ghost" type="button" onClick={onCancel}>
          <X size={16} aria-hidden="true" />
          {cancelLabel}
        </button>
      )}
    </div>
  );
}

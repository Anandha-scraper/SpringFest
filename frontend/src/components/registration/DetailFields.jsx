import { DEPARTMENTS, STUDY_YEARS, TN_CITIES, yearLabel } from "../../content/formOptions.js";

/** The academic block every participant fills in, lead and teammate alike.
 * Shared so the two can't drift — the backend validates both with the same
 * parseParticipantDetails(). Used by RegistrationForm and AddTeammate.
 *
 * Each label + control is wrapped in a `.field` so the form can lay them out
 * in a grid without the flat label/input sequence fighting it. */
export default function DetailFields({ idPrefix, values, onChange, labelled }) {
  const field = (name) => (idPrefix ? `${idPrefix}-${name}` : name);
  return (
    <>
      <div className="field">
        {labelled && <label htmlFor={field("college")}>College</label>}
        <input
          id={field("college")}
          placeholder="College name"
          required
          minLength={2}
          value={values.college}
          onChange={(e) => onChange("college", e.target.value)}
        />
      </div>

      <div className="field">
        {labelled && <label htmlFor={field("department")}>Department</label>}
        <select
          id={field("department")}
          required
          value={values.department}
          onChange={(e) => onChange("department", e.target.value)}
        >
          <option value="" disabled>Department</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      <div className="field">
        {labelled && <label htmlFor={field("year")}>Year of study</label>}
        <select
          id={field("year")}
          required
          value={values.year}
          onChange={(e) => onChange("year", e.target.value)}
        >
          <option value="" disabled>Year of study</option>
          {STUDY_YEARS.map((y) => (
            <option key={y} value={y}>{yearLabel(y)}</option>
          ))}
        </select>
      </div>

      <div className="field">
        {labelled && <label htmlFor={field("location")}>Location</label>}
        <select
          id={field("location")}
          required
          value={values.location}
          onChange={(e) => onChange("location", e.target.value)}
        >
          <option value="" disabled>City / district</option>
          {TN_CITIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {values.location === "Other" && (
          <input
            placeholder="Your city"
            required
            minLength={2}
            value={values.location_other}
            onChange={(e) => onChange("location_other", e.target.value)}
          />
        )}
      </div>
    </>
  );
}

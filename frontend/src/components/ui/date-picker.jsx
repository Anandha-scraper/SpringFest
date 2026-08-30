import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { CalendarSearch } from "lucide-react";

/**
 * Reusable hand-rolled date picker (mobile + laptop responsive).
 *
 * API:
 *  - `value`  — a "YYYY-MM-DD" string (or empty).
 *  - `onChange` — called with the chosen date. Two forms:
 *      * If a `name` prop is supplied it is called as a synthetic form
 *        event, `onChange({ target: { name, value } })`, so it drops
 *        straight into a `setForm({ ...form, [e.target.name]: e.target.value })`
 *        handler.
 *      * If no `name` is supplied it is called with the plain string value,
 *        mirroring the previous `DatePicker` so existing callers keep working.
 *  - `max` — the newest selectable date. Defaults to today, so a plain
 *    <DatePicker> is a past-date field (a birth date, say).
 *  - `min` — the oldest selectable date. Unset by default. Pass
 *    `min={today} max={null}` to make it a future-date field instead, which
 *    is what scheduling an event needs.
 *  - `ref` — exposes `focus()`, `open()`, `close()`.
 */
/** Midnight on the first of that date's month — so navigating *to* the
 *  month containing `min` is allowed even though earlier days in it are not. */
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

/** "YYYY-MM-DD" as *local* midnight.
 *
 * `new Date("2026-08-30")` is parsed as UTC midnight, which east of Greenwich
 * lands on the previous local day — so a `min` of today would block today. The
 * calendar builds its cells from local components, so bounds must match. */
const parseLocalDate = (value) => {
  if (value instanceof Date) return value;
  const [y, m, d] = String(value).split("-").map(Number);
  return Number.isFinite(y) ? new Date(y, (m || 1) - 1, d || 1) : new Date(value);
};

const CustomDatePicker = forwardRef(
  (
    {
      value,
      onChange,
      max,
      min,
      style,
      name,
      onKeyDown,
      disabled,
      className = "",
      onFocus,
      onBlur,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState(value || "");
    const [viewDate, setViewDate] = useState(value ? new Date(value) : new Date());
    const [showYearList, setShowYearList] = useState(false);
    const [showMonthList, setShowMonthList] = useState(false);

    const pickerRef = useRef(null);
    const inputRef = useRef(null);
    const yearDragRef = useRef(null);
    const monthDragRef = useRef(null);
    const yearListRef = useRef(null);
    const monthListRef = useRef(null);

    // Expose focus/open/close methods to parent via ref
    useImperativeHandle(ref, () => ({
      focus: () => {
        inputRef.current?.focus();
      },
      open: () => {
        if (!disabled) {
          setIsOpen(true);
        }
      },
      close: () => {
        setIsOpen(false);
      },
    }));

    // `max === null` explicitly means "no upper bound", which is how a
    // future-date field opts out of the default-to-today behaviour;
    // `undefined` still means "today".
    const maxDate = max === null ? null : max ? parseLocalDate(max) : new Date();
    const minDate = min ? parseLocalDate(min) : null;

    /** Both bounds are inclusive and compared by calendar day.
     *
     * Day granularity matters: `maxDate` defaults to `new Date()`, which
     * carries a time, so comparing raw Date objects would reject every hour of
     * today before "now". Comparing YYYY-MM-DD strings sidesteps that and the
     * UTC/local offset issue in one go. */
    const outOfRange = (date) => {
      const d = formatDate(date);
      return (maxDate && d > formatDate(maxDate)) || (minDate && d < formatDate(minDate));
    };

    useEffect(() => {
      if (value) {
        setSelectedDate(value);
        setViewDate(new Date(value));
      } else {
        setSelectedDate("");
        setViewDate(new Date());
      }
    }, [value]);

    // Close picker when clicking outside
    useEffect(() => {
      const handleClickOutside = (event) => {
        if (pickerRef.current && !pickerRef.current.contains(event.target)) {
          setIsOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const formatDate = (date) => {
      if (!date) return "";
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const formatDisplayDate = (dateStr) => {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const getDaysInMonth = (year, month) => {
      return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (year, month) => {
      return new Date(year, month, 1).getDay();
    };

    const handleDateSelect = (day) => {
      const year = viewDate.getFullYear();
      const month = viewDate.getMonth();
      const newDate = new Date(year, month, day);

      if (!outOfRange(newDate)) {
        const formatted = formatDate(newDate);
        setSelectedDate(formatted);
        if (onChange) {
          onChange(name ? { target: { name, value: formatted } } : formatted);
        }
        setIsOpen(false);
      }
    };

    // Navigation is blocked only when the whole month/year being moved to is
    // past a bound — moving away from a bound is always allowed.
    const changeMonth = (direction) => {
      const newDate = new Date(viewDate);
      newDate.setMonth(newDate.getMonth() + direction);

      if (direction > 0 ? !maxDate || newDate <= maxDate : !minDate || newDate >= startOfMonth(minDate)) {
        setViewDate(newDate);
      }
    };

    const changeYear = (direction) => {
      const newDate = new Date(viewDate);
      newDate.setFullYear(newDate.getFullYear() + direction);

      if (direction > 0 ? !maxDate || newDate <= maxDate : !minDate || newDate >= startOfMonth(minDate)) {
        setViewDate(newDate);
      }
    };

    const selectYear = (year) => {
      const newDate = new Date(viewDate);
      newDate.setFullYear(year);
      setViewDate(newDate);
      setShowYearList(false);
    };

    const selectMonth = (monthIndex) => {
      const newDate = new Date(viewDate);
      newDate.setMonth(monthIndex);
      setViewDate(newDate);
      setShowMonthList(false);
    };

    const getYearList = () => {
      const currentYear = viewDate.getFullYear();
      const years = [];

      // Bounded by whichever limits exist; otherwise a century either side.
      const startYear = minDate ? minDate.getFullYear() : Math.max(1900, currentYear - 100);
      const endYear = maxDate ? maxDate.getFullYear() : currentYear + 100;

      for (let year = endYear; year >= startYear; year--) {
        years.push(year);
      }

      return years;
    };

    const getMonthList = () => {
      return [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
    };

    // Auto-scroll to selected year when list opens
    useEffect(() => {
      if (showYearList && yearListRef.current) {
        const selectedYearElement = yearListRef.current.querySelector(".year-item.selected");
        if (selectedYearElement) {
          selectedYearElement.scrollIntoView({ block: "center", behavior: "auto" });
        }
      }
    }, [showYearList]);

    // Auto-scroll to selected month when list opens
    useEffect(() => {
      if (showMonthList && monthListRef.current) {
        const selectedMonthElement = monthListRef.current.querySelector(".month-item.selected");
        if (selectedMonthElement) {
          selectedMonthElement.scrollIntoView({ block: "center", behavior: "auto" });
        }
      }
    }, [showMonthList]);

    const handleYearClick = () => {
      setShowYearList(!showYearList);
      setShowMonthList(false);
    };

    const handleMonthClick = () => {
      setShowMonthList(!showMonthList);
      setShowYearList(false);
    };

    const renderCalendar = () => {
      const year = viewDate.getFullYear();
      const month = viewDate.getMonth();
      const daysInMonth = getDaysInMonth(year, month);
      const firstDay = getFirstDayOfMonth(year, month);
      const today = new Date();

      const days = [];
      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

      // Add empty cells for days before the first day of month
      for (let i = 0; i < firstDay; i++) {
        days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
      }

      // Add days of the month
      for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month, day);
        const isToday = currentDate.toDateString() === today.toDateString();
        const isSelected = selectedDate && currentDate.toDateString() === new Date(selectedDate).toDateString();
        const blocked = outOfRange(currentDate);

        days.push(
          <div
            key={day}
            className={`calendar-day ${isToday ? "today" : ""} ${isSelected ? "selected" : ""} ${blocked ? "disabled" : ""}`}
            onClick={() => !blocked && handleDateSelect(day)}
          >
            {day}
          </div>
        );
      }

      return (
        <div className="calendar-popup">
          <div className="calendar-header">
            <div className="calendar-nav">
              <div
                className={`month-year-display ${showMonthList ? "active" : ""}`}
                ref={monthDragRef}
                onClick={handleMonthClick}
              >
                <span className="month-text">{monthNames[month]}</span>
              </div>
            </div>
            <div className="calendar-nav">
              <div
                className={`month-year-display ${showYearList ? "active" : ""}`}
                ref={yearDragRef}
                onClick={handleYearClick}
              >
                <span className="year-text">{year}</span>
              </div>
            </div>
          </div>

          {showYearList && (
            <div className="year-list-container" ref={yearListRef}>
              <div className="year-list">
                {getYearList().map((y) => (
                  <div
                    key={y}
                    className={`year-item ${y === year ? "selected" : ""}`}
                    onClick={() => selectYear(y)}
                  >
                    {y}
                  </div>
                ))}
              </div>
            </div>
          )}

          {showMonthList && (
            <div className="month-list-container" ref={monthListRef}>
              <div className="month-list">
                {getMonthList().map((m, index) => (
                  <div
                    key={m}
                    className={`month-item ${index === month ? "selected" : ""}`}
                    onClick={() => selectMonth(index)}
                  >
                    {m}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!showYearList && !showMonthList && (
            <>
              <div className="calendar-weekdays">
                {dayNames.map((day) => (
                  <div key={day} className="weekday">
                    {day}
                  </div>
                ))}
              </div>
              <div className="calendar-grid">{days}</div>
            </>
          )}
        </div>
      );
    };

    return (
      <div className={`custom-date-picker ${className}`} ref={pickerRef}>
        <div className="date-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            value={formatDisplayDate(selectedDate)}
            onClick={() => !disabled && setIsOpen(!isOpen)}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder="e.g: DD/MM/YYYY"
            readOnly
            disabled={disabled}
            style={{ ...style, ...(disabled ? { backgroundColor: "#f1f5f9", cursor: "not-allowed", opacity: 0.8 } : {}) }}
            className="date-input"
          />
          <span
            className="calendar-icon"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            style={{ cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, display: "flex", alignItems: "center" }}
          >
            <CalendarSearch size={18} color="#5B9AA9" strokeWidth={2} />
          </span>
        </div>
        {isOpen && renderCalendar()}
      </div>
    );
  }
);

CustomDatePicker.displayName = "CustomDatePicker";

export { CustomDatePicker as DatePicker };
export default CustomDatePicker;

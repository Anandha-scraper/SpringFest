import { fest } from "@/content/fest.js";

export default function ScheduleFlow() {
  return (
    <div className="schedule-flow">
      <div className="schedule-day-list">
        {fest.schedule.map((day) => (
          <div className="schedule-day" key={`${day.day}-${day.date}`}>
            <div className="flow-day">
              <strong>{day.day}</strong>
              <span>{day.date}</span>
            </div>
            <ol className="flow-slot-list">
              {day.items.map((item, i) => (
                <li className="flow-slot" key={`${day.day}-${i}`}>
                  <span className="flow-time">{item.time}</span>
                  <div className="flow-slot-body">
                    <h4>{item.title}</h4>
                    <p>{item.venue}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}
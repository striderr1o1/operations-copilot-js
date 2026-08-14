import { useEffect, useState } from "react";
import { fetchSlots } from "../../lib/api.js";
import "./CheckSlotsPanel.css";

function formatSlotTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function CheckSlotsPanel() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetchSlots()
      .then((data) => {
        if (!alive) return;
        setSlots(data?.slots ?? []);
      })
      .catch((err) => {
        if (alive) setError(err.message || "slots unavailable");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="panel-page">
      <header className="panel-head">
        <div className="panel-head-text">
          <span className="panel-title">Check Slots</span>
          <span className="panel-sub">
            Reservations currently booked for your business.
          </span>
        </div>
        <span className="slots-count mono">
          {loading ? "loading…" : `${slots.length} slot${slots.length === 1 ? "" : "s"}`}
        </span>
      </header>

      <div className="panel-body">
        <section className="slots-card card">
          {loading ? (
            <div className="slots-state">
              <span className="slots-spinner" />
              <span>fetching slots…</span>
            </div>
          ) : error ? (
            <div className="slots-state is-error">could not load slots: {error}</div>
          ) : slots.length === 0 ? (
            <div className="slots-state">
              <span className="slots-state-mark mono">///</span>
              <span>no slots booked yet</span>
            </div>
          ) : (
            <div className="slots-table-wrap">
              <table className="slots-table">
                <thead>
                  <tr>
                    <th>start</th>
                    <th>end</th>
                    <th>occupier email</th>
                    <th>slot id</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map((slot) => (
                    <tr key={slot.slotid}>
                      <td className="mono">{formatSlotTime(slot.time_start)}</td>
                      <td className="mono">{formatSlotTime(slot.time_end)}</td>
                      <td>{slot.occupier_email || "—"}</td>
                      <td className="slots-id mono">{slot.slotid || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

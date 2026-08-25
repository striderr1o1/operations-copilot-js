import { useCallback, useEffect, useState } from "react";
import { addSlot, deleteSlot, fetchSlots } from "../../lib/api.js";
import "./CheckSlotsPanel.css";

function statusTone(status) {
  const value = (status || "").toLowerCase();
  if (["confirmed", "booked", "active"].includes(value)) return "is-confirmed";
  if (["cancelled", "canceled", "expired"].includes(value)) return "is-cancelled";
  if (["pending", "hold"].includes(value)) return "is-pending";
  return "is-default";
}

// slots are stored (and booked by the agent) as UTC timestamps, so render them
// in UTC too — formatting in the viewer's zone would shift every row away from
// what the database and the confirmation email actually say
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
    timeZone: "UTC",
  });
}

// <input type="datetime-local"> hands back "2026-08-27T23:00" with no zone. The
// form is labelled UTC to match the table, so pin the offset rather than
// letting Date reinterpret it in the browser's zone.
function toUtcIso(local) {
  if (!local) return "";
  const withSeconds = local.length === 16 ? `${local}:00` : local;
  return `${withSeconds}+00:00`;
}

const EMPTY_FORM = { start: "", end: "" };

export default function CheckSlotsPanel() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(null);

  const load = useCallback(async () => {
    const data = await fetchSlots();
    setSlots(data?.slots ?? []);
  }, []);

  useEffect(() => {
    let alive = true;
    load()
      .catch((err) => {
        if (alive) setError(err.message || "slots unavailable");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [load]);

  const remove = async (slot, index) => {
    // the row key doubles as the busy marker: /get-slots-data does not always
    // hand back a slotid, and the index still tells the rows apart
    const key = slot.slotid ?? `#${index}`;
    setRemoving(key);
    setError("");
    try {
      await deleteSlot(slot.slotid);
      await load();
    } catch (err) {
      setError(err.message || "could not delete that slot");
    } finally {
      setRemoving(null);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.start || !form.end) return setFormError("Both a start and an end are required.");
    if (new Date(toUtcIso(form.end)) <= new Date(toUtcIso(form.start)))
      return setFormError("The end must come after the start.");

    setFormError("");
    setSaving(true);
    try {
      await addSlot({ time_start: toUtcIso(form.start), time_end: toUtcIso(form.end) });
      await load();
      setForm(EMPTY_FORM);
      setComposing(false);
    } catch (err) {
      setFormError(err.message || "could not create that slot");
    } finally {
      setSaving(false);
    }
  };

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

      <div className="panel-body slots-body">
        <div className="slots-layout">
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
                      <th>slot id</th>
                      <th>start (utc)</th>
                      <th>end (utc)</th>
                      <th>occupier email</th>
                      <th>status</th>
                      <th aria-label="actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map((slot, index) => (
                      <tr key={slot.slotid || `${slot.time_start}-${index}`}>
                        <td className="mono slots-id" title={slot.slotid || ""}>
                          {slot.slotid || "—"}
                        </td>
                        <td className="mono">{formatSlotTime(slot.time_start)}</td>
                        <td className="mono">{formatSlotTime(slot.time_end)}</td>
                        <td>{slot.occupier_email || "—"}</td>
                        <td>
                          <span className={`slot-status ${statusTone(slot.status)}`}>
                            {slot.status || "unknown"}
                          </span>
                        </td>
                        <td className="slots-actions-cell">
                          <button
                            type="button"
                            className="slot-delete"
                            onClick={() => remove(slot, index)}
                            disabled={removing === (slot.slotid ?? `#${index}`)}
                            title="Delete this slot"
                            aria-label={`Delete slot starting ${formatSlotTime(slot.time_start)}`}
                          >
                            {removing === (slot.slotid ?? `#${index}`) ? (
                              <span className="slots-spinner is-small" />
                            ) : (
                              <svg
                                viewBox="0 0 24 24"
                                width="15"
                                height="15"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                strokeLinecap="round"
                              >
                                <path d="M4 7h16" />
                                <path d="M10 11v6M14 11v6" />
                                <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
                                <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                              </svg>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {composing && (
            <form className="slots-new card" onSubmit={submit}>
              <header className="slots-new-head">
                <div>
                  <span className="slots-new-title">New slot</span>
                  <span className="slots-new-sub">
                    Blocked out by you — no occupier, starts as pending.
                  </span>
                </div>
                <button
                  type="button"
                  className="slots-new-close"
                  onClick={() => {
                    setComposing(false);
                    setFormError("");
                  }}
                  aria-label="Close new slot form"
                >
                  ✕
                </button>
              </header>

              <label className="field">
                <span className="field-label">start (utc)</span>
                <input
                  className="field-input mono"
                  type="datetime-local"
                  value={form.start}
                  onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
                />
              </label>

              <label className="field">
                <span className="field-label">end (utc)</span>
                <input
                  className="field-input mono"
                  type="datetime-local"
                  value={form.end}
                  onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}
                />
              </label>

              <div className="slots-new-meta mono">
                <span>occupier · none</span>
                <span>status · pending</span>
              </div>

              {formError && <p className="slots-new-error">{formError}</p>}

              <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create slot"}
              </button>
            </form>
          )}
        </div>
      </div>

      <button
        type="button"
        className={`slots-fab ${composing ? "is-open" : ""}`}
        onClick={() => {
          setFormError("");
          setComposing((open) => !open);
        }}
        aria-expanded={composing}
        aria-label={composing ? "Close new slot form" : "Add a slot"}
        title={composing ? "Close" : "Add a slot"}
      >
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
}

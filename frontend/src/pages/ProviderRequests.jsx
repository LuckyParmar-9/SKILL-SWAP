import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import { useCall } from "../context/CallContext";

const StatusPill = ({ status }) => <span className={`status-pill status-${status}`}>{status}</span>;

const ProviderRequests = () => {
  const [bookings, setBookings] = useState([]);
  const [scheduleDrafts, setScheduleDrafts] = useState({}); // { [bookingId]: { date, startTime, endTime } }
  const { startCall } = useCall();
  const navigate = useNavigate();

  const load = () => api.get("/bookings/incoming").then((res) => setBookings(res.data)); // US-20
  useEffect(() => { load(); }, []);

  const respond = async (id, action) => {
    await api.put(`/bookings/${id}/respond`, { action }); // US-21
    load();
  };

  const markComplete = async (id) => {
    await api.put(`/bookings/${id}/complete`);
    load();
  };

  const updateDraft = (bookingId, field, value) => {
    setScheduleDrafts((prev) => ({
      ...prev,
      [bookingId]: { ...prev[bookingId], [field]: value },
    }));
  };

  const scheduleSession = async (bookingId) => {
    const draft = scheduleDrafts[bookingId];
    if (!draft?.date || !draft?.startTime || !draft?.endTime) return;
    await api.put(`/bookings/${bookingId}/schedule`, draft);
    setScheduleDrafts((prev) => ({ ...prev, [bookingId]: undefined }));
    load();
  };

  return (
    <div className="page">
      <h1 className="page-title">Incoming Learning Requests</h1>
      <p className="page-sub">Manage learners who want to book paid sessions with you.</p>
      <p style={{ marginBottom: 20 }}>
        <Link to="/my-paid-listings" className="btn btn-outline btn-small">Manage My Listings</Link>
      </p>

      {bookings.length === 0 && <p className="empty-state">No requests yet.</p>}

      {bookings.map((b) => {
        const firstPaid = b.payment?.first?.status === "paid";
        const isSplit = b.payment?.plan === "split";
        const gateOpen = firstPaid; // learner has cleared their first payment
        const isScheduled = Boolean(b.slot?.date);
        const needsScheduling = b.status === "confirmed" && firstPaid && !isScheduled;
        const canMarkComplete = b.status === "confirmed" && firstPaid && isScheduled;
        const draft = scheduleDrafts[b._id] || {};

        return (
          <div key={b._id} className="list-card" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div className="list-card-main">
                <h4>{b.listing?.skill} — ₹{b.price}</h4>
                <p>Learner: {b.learner?.name}</p>
                <p>
                  {isScheduled
                    ? `Scheduled: ${b.slot.date} ${b.slot.startTime}-${b.slot.endTime}`
                    : "Time not scheduled yet"}
                </p>
                {firstPaid && (
                  <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
                    Payment: {isSplit ? `split (${b.payment.splitPercent}% up front)` : "paid in full"}
                    {isSplit && b.payment.second.status === "due" && " · final payment due from learner"}
                    {isSplit && b.payment.second.status === "not_due" && " · final payment not requested yet"}
                  </p>
                )}
              </div>
              <div className="list-card-actions">
                <StatusPill status={b.status} />
                {b.status === "pending" && (
                  <>
                    <button className="btn btn-primary btn-small" onClick={() => respond(b._id, "accept")}>Accept</button>
                    <button className="btn btn-outline btn-small" onClick={() => respond(b._id, "reject")}>Reject</button>
                  </>
                )}

                {canMarkComplete && (
                  <button className="btn btn-primary btn-small" onClick={() => markComplete(b._id)}>
                    Mark Session Complete
                  </button>
                )}

                {gateOpen && (
                  <>
                    <button
                      className="btn btn-outline btn-small"
                      onClick={() => navigate(`/messages/${b.learner._id}`)}
                    >
                      Message
                    </button>
                    <button
                      className="btn btn-outline btn-small"
                      onClick={() => startCall(b.learner._id, b.learner.name, "audio")}
                    >
                      Call
                    </button>
                  </>
                )}
              </div>
            </div>

            {needsScheduling && (
              <div style={{ marginTop: 12, borderTop: "1px solid var(--pista-lighter)", paddingTop: 12 }}>
                <strong style={{ display: "block", marginBottom: 8 }}>Schedule this session</strong>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <input
                    type="date"
                    value={draft.date || ""}
                    onChange={(e) => updateDraft(b._id, "date", e.target.value)}
                  />
                  <input
                    type="time"
                    value={draft.startTime || ""}
                    onChange={(e) => updateDraft(b._id, "startTime", e.target.value)}
                  />
                  <input
                    type="time"
                    value={draft.endTime || ""}
                    onChange={(e) => updateDraft(b._id, "endTime", e.target.value)}
                  />
                  <button className="btn btn-primary btn-small" onClick={() => scheduleSession(b._id)}>
                    Confirm Time
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ProviderRequests;

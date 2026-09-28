import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { useCall } from "../context/CallContext";
import StatusPill from "../components/StatusPill";

const ProviderRequests = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState("requests"); // "requests" | "earnings"
  const [bookings, setBookings] = useState([]);
  const [scheduleDrafts, setScheduleDrafts] = useState({}); // { [bookingId]: { date, startTime, endTime } }
  const [showProposeFor, setShowProposeFor] = useState({}); // { [bookingId]: true } — re-open the form to counter-suggest
  const [earnings, setEarnings] = useState(null);
  const { startCall } = useCall();
  const navigate = useNavigate();

  const load = () => api.get("/bookings/incoming").then((res) => setBookings(res.data)); // US-20
  const loadEarnings = () => api.get("/bookings/earnings").then((res) => setEarnings(res.data));

  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === "earnings") loadEarnings(); }, [tab]);

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

  const proposeSchedule = async (bookingId) => {
    const draft = scheduleDrafts[bookingId];
    if (!draft?.date || !draft?.startTime || !draft?.endTime) return;
    await api.put(`/bookings/${bookingId}/propose-schedule`, draft);
    setScheduleDrafts((prev) => ({ ...prev, [bookingId]: undefined }));
    setShowProposeFor((prev) => ({ ...prev, [bookingId]: false }));
    load();
  };

  const respondSchedule = async (bookingId, action) => {
    await api.put(`/bookings/${bookingId}/respond-schedule`, { action });
    load();
  };

  return (
    <div className="page">
      <h1 className="page-title">Incoming Learning Requests</h1>
      <p className="page-sub">Manage learners who want to book paid sessions with you.</p>
      <p style={{ marginBottom: 20 }}>
        <Link to="/my-paid-listings" className="btn btn-outline btn-small">Manage My Listings</Link>
      </p>

      <div className="tabs">
        <button className={`tab ${tab === "requests" ? "active" : ""}`} onClick={() => setTab("requests")}>Requests</button>
        <button className={`tab ${tab === "earnings" ? "active" : ""}`} onClick={() => setTab("earnings")}>Payments & Earnings</button>
      </div>

      {tab === "requests" && (
        <>
          {bookings.length === 0 && <p className="empty-state">No requests yet.</p>}

          {bookings.map((b) => {
            const firstPaid = b.payment?.first?.status === "paid";
            const isSplit = b.payment?.plan === "split";
            const gateOpen = firstPaid; // learner has cleared their first payment
            const isScheduled = Boolean(b.slot?.date);
            const canSchedule = b.status === "confirmed" && firstPaid && !isScheduled;
            const canMarkComplete = b.status === "confirmed" && firstPaid && isScheduled;
            const draft = scheduleDrafts[b._id] || {};

            const proposal = b.scheduleProposal;
            const hasPendingProposal = proposal?.status === "pending";
            const proposedByMe = hasPendingProposal && String(proposal.proposedBy?._id || proposal.proposedBy) === String(user._id);
            const proposedByOther = hasPendingProposal && !proposedByMe;
            const showForm = canSchedule && (!hasPendingProposal || showProposeFor[b._id]);

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

                {canSchedule && proposedByOther && (
                  <div style={{ marginTop: 12, borderTop: "1px solid var(--pista-lighter)", paddingTop: 12 }}>
                    <p>
                      <strong>{b.learner?.name}</strong> suggested: {proposal.date} {proposal.startTime}-{proposal.endTime}
                    </p>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button className="btn btn-primary btn-small" onClick={() => respondSchedule(b._id, "accept")}>
                        Accept This Time
                      </button>
                      <button className="btn btn-outline btn-small" onClick={() => respondSchedule(b._id, "reject")}>
                        Decline
                      </button>
                    </div>
                  </div>
                )}

                {canSchedule && proposedByMe && !showProposeFor[b._id] && (
                  <div style={{ marginTop: 12, borderTop: "1px solid var(--pista-lighter)", paddingTop: 12 }}>
                    <p>Waiting for {b.learner?.name} to respond to your suggestion: {proposal.date} {proposal.startTime}-{proposal.endTime}</p>
                    <button
                      className="btn btn-outline btn-small"
                      onClick={() => setShowProposeFor((prev) => ({ ...prev, [b._id]: true }))}
                    >
                      Suggest a Different Time
                    </button>
                  </div>
                )}

                {showForm && (
                  <div style={{ marginTop: 12, borderTop: "1px solid var(--pista-lighter)", paddingTop: 12 }}>
                    <strong style={{ display: "block", marginBottom: 8 }}>Suggest a session time</strong>
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
                      <button className="btn btn-primary btn-small" onClick={() => proposeSchedule(b._id)}>
                        Suggest This Time
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {tab === "earnings" && (
        <>
          {!earnings ? (
            <div className="loading">Loading earnings...</div>
          ) : (
            <>
              <div className="grid-2" style={{ marginBottom: 26 }}>
                <div className="card">
                  <h3 style={{ margin: "0 0 6px" }}>Total Earned</h3>
                  <p style={{ fontSize: 28, fontWeight: 800, color: "var(--pista-darker)", margin: 0 }}>
                    ₹{earnings.totalEarned}
                  </p>
                  <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 6 }}>
                    Across {earnings.transactions.length} completed payment{earnings.transactions.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="card">
                  <h3 style={{ margin: "0 0 6px" }}>Pending</h3>
                  <p style={{ fontSize: 28, fontWeight: 800, color: "var(--warning)", margin: 0 }}>
                    ₹{earnings.pendingAmount}
                  </p>
                  <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 6 }}>
                    Final installments not yet collected
                  </p>
                </div>
              </div>

              <h3>Pending Payments</h3>
              {earnings.pending.length === 0 && <p className="empty-state">Nothing pending right now.</p>}
              {earnings.pending.map((p) => (
                <div key={p.bookingId} className="list-card">
                  <div className="list-card-main">
                    <h4>{p.skill}</h4>
                    <p>Learner: {p.learner}</p>
                  </div>
                  <div className="list-card-actions">
                    <span style={{ fontWeight: 700, color: "var(--warning)" }}>₹{p.amount}</span>
                    <StatusPill status="pending">
                      {p.status === "due" ? "awaiting learner payment" : "not requested yet"}
                    </StatusPill>
                  </div>
                </div>
              ))}

              <h3 style={{ marginTop: 30 }}>Transaction History</h3>
              {earnings.transactions.length === 0 && <p className="empty-state">No payments received yet.</p>}
              {earnings.transactions.length > 0 && (
                <table>
                  <thead>
                    <tr><th>Skill</th><th>Learner</th><th>Type</th><th>Amount</th><th>Payment ID</th></tr>
                  </thead>
                  <tbody>
                    {earnings.transactions.map((t, i) => (
                      <tr key={`${t.bookingId}-${t.leg}-${i}`}>
                        <td>{t.skill}</td>
                        <td>{t.learner}</td>
                        <td>{t.leg === "first" ? "First payment" : "Final payment"}</td>
                        <td>₹{t.amount}</td>
                        <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.paymentId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default ProviderRequests;

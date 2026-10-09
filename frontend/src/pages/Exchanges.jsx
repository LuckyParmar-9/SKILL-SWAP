import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { useCall } from "../context/CallContext";
import StatusPill from "../components/StatusPill";

const FILTERS = ["all", "pending", "active", "completed", "rejected", "cancelled"];

const Exchanges = () => {
  const { user } = useAuth();
  const { startCall } = useCall();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("free"); // "free" | "paid"
  const [filter, setFilter] = useState("all");

  const [exchanges, setExchanges] = useState([]);
  const [bookings, setBookings] = useState([]);

  const [ratingFor, setRatingFor] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  // Separate state for rating a free exchange, so it doesn't collide with
  // the paid-booking rating state above when switching tabs.
  const [ratingForExchange, setRatingForExchange] = useState(null);
  const [exchangeRating, setExchangeRating] = useState(5);
  const [exchangeComment, setExchangeComment] = useState("");

  const [scheduleDrafts, setScheduleDrafts] = useState({}); // { [bookingId]: { date, startTime, endTime } }
  const [showProposeFor, setShowProposeFor] = useState({}); // { [bookingId]: true }

  const loadExchanges = () => api.get("/exchanges").then((res) => setExchanges(res.data));
  const loadBookings = () => api.get("/bookings/mine").then((res) => setBookings(res.data));
  useEffect(() => {
    loadExchanges();
    loadBookings();
  }, []);

  const act = async (id, action) => {
    await api.put(`/exchanges/${id}/${action}`);
    loadExchanges();
  };

  const submitRating = async (booking) => {
    await api.post("/reviews", {
      providerId: booking.provider._id,
      type: "paidLearning",
      refId: booking._id,
      rating,
      comment,
    });
    setRatingFor(null);
    setComment("");
    setRating(5);
    loadBookings();
  };

  // Free exchanges are two-way, so "the person being rated" is simply
  // whichever side of the exchange isn't me.
  const submitExchangeRating = async (ex) => {
    const iAmReceiver = String(ex.receiver._id) === String(user._id);
    const other = iAmReceiver ? ex.requester : ex.receiver;
    await api.post("/reviews", {
      providerId: other._id,
      type: "exchange",
      refId: ex._id,
      rating: exchangeRating,
      comment: exchangeComment,
    });
    setRatingForExchange(null);
    setExchangeComment("");
    setExchangeRating(5);
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
    loadBookings();
  };

  const respondSchedule = async (bookingId, action) => {
    await api.put(`/bookings/${bookingId}/respond-schedule`, { action });
    loadBookings();
  };

  // Free exchanges use their status field directly. Paid bookings have a
  // couple of extra in-between statuses ("accepted", "confirmed") that both
  // count as "active" here, so the same filter row means the same thing on
  // both tabs.
  const filteredExchanges = filter === "all" ? exchanges : exchanges.filter((e) => e.status === filter);
  const filteredBookings =
    filter === "all"
      ? bookings
      : filter === "active"
      ? bookings.filter((b) => ["accepted", "confirmed"].includes(b.status))
      : bookings.filter((b) => b.status === filter);

  return (
    <div className="page">
      <h1 className="page-title">Skill Exchanges</h1>
      <p className="page-sub">Manage exchange requests you've sent and received.</p>

      <div className="tabs" style={{ marginBottom: 6 }}>
        <button className={`tab ${activeTab === "free" ? "active" : ""}`} onClick={() => setActiveTab("free")}>
          Free Exchanges
        </button>
        <button className={`tab ${activeTab === "paid" ? "active" : ""}`} onClick={() => setActiveTab("paid")}>
          Paid Learning Requests
        </button>
      </div>

      <div className="tabs">
        {FILTERS.map((f) => (
          <button key={f} className={`tab ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      {activeTab === "free" && (
        <>
          {filteredExchanges.length === 0 && (
            <p className="empty-state">No exchanges here. <Link to="/matches">Find a match</Link> to get started.</p>
          )}

          {filteredExchanges.map((ex) => {
            const iAmReceiver = String(ex.receiver._id) === String(user._id);
            const other = iAmReceiver ? ex.requester : ex.receiver;
            return (
              <div key={ex._id} className="list-card" style={{ flexDirection: "column", alignItems: "stretch" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div className="list-card-main">
                    <h4>{ex.requesterSkill} ⇄ {ex.receiverSkill}</h4>
                    <p>With {other.name}</p>
                  </div>
                  <div className="list-card-actions">
                    <StatusPill status={ex.status} />
                    {ex.status === "pending" && iAmReceiver && (
                      <>
                        <button className="btn btn-primary btn-small" onClick={() => act(ex._id, "accept")}>Accept</button>
                        <button className="btn btn-outline btn-small" onClick={() => act(ex._id, "reject")}>Reject</button>
                      </>
                    )}
                    {ex.status === "active" && (
                      <>
                        <button className="btn btn-primary btn-small" onClick={() => act(ex._id, "complete")}>Mark Completed</button>
                        <button className="btn btn-outline btn-small" onClick={() => act(ex._id, "cancel")}>Cancel</button>
                      </>
                    )}
                    {ex.status === "completed" && (
                      <button className="btn btn-outline btn-small" onClick={() => setRatingForExchange(ex._id)}>
                        Rate {other.name?.split(" ")[0]}
                      </button>
                    )}
                    <Link className="btn btn-outline btn-small" to={`/exchanges/${ex._id}`}>Details</Link>
                  </div>
                </div>

                {ratingForExchange === ex._id && (
                  <div style={{ marginTop: 12, borderTop: "1px solid var(--pista-lighter)", paddingTop: 12 }}>
                    <div className="form-group">
                      <label>Rating</label>
                      <select value={exchangeRating} onChange={(e) => setExchangeRating(Number(e.target.value))}>
                        {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} stars</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Review</label>
                      <textarea
                        rows={2}
                        value={exchangeComment}
                        onChange={(e) => setExchangeComment(e.target.value)}
                        placeholder={`How was learning from ${other.name}?`}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-primary btn-small" onClick={() => submitExchangeRating(ex)}>
                        Submit Rating & Review
                      </button>
                      <button className="btn btn-outline btn-small" onClick={() => setRatingForExchange(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {activeTab === "paid" && (
        <>
          {filteredBookings.length === 0 && (
            <p className="empty-state">No paid learning requests here. <Link to="/paid-providers">Browse paid learning</Link></p>
          )}

          {filteredBookings.map((b) => {
            const firstPaid = b.payment?.first?.status === "paid";
            const isSplit = b.payment?.plan === "split";
            const secondDue = isSplit && b.payment?.second?.status === "due";
            const fullyPaid = firstPaid && (!isSplit || b.payment?.second?.status === "paid");
            const gateOpen = firstPaid; // messaging/calling unlock the moment the first payment clears
            const isScheduled = Boolean(b.slot?.date);
            const canSchedule = b.status === "confirmed" && firstPaid && !isScheduled;
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
                    <h4>{b.listing?.skill}</h4>
                    <p>
                      With {b.provider?.name} ·{" "}
                      {isScheduled
                        ? `${b.slot.date} ${b.slot.startTime}-${b.slot.endTime}`
                        : b.status === "confirmed" || b.status === "completed"
                        ? "Time not scheduled yet"
                        : "Time to be scheduled after payment"}
                    </p>
                    <p>
                      Price: ₹{b.price}
                      {" · "}
                      Payment:{" "}
                      <StatusPill status={firstPaid ? "paid" : "unpaid"}>
                        {fullyPaid ? "fully paid" : firstPaid ? "first payment done" : "unpaid"}
                      </StatusPill>
                    </p>
                  </div>
                  <div className="list-card-actions">
                    <StatusPill status={b.status} />

                    {b.status === "accepted" && !firstPaid && (
                      <Link className="btn btn-primary btn-small" to={`/booking/${b._id}`}>Pay Now</Link>
                    )}
                    {secondDue && (
                      <Link className="btn btn-primary btn-small" to={`/booking/${b._id}`}>Pay Final Amount</Link>
                    )}
                    {firstPaid && isSplit && b.payment?.second?.status === "not_due" && (
                      <span
                        className="status-pill"
                        title="Opens once the provider marks the session completed"
                        style={{ display: "inline-block", padding: "4px 14px", borderRadius: 999, whiteSpace: "nowrap" }}
                      >
                        Final payment not due yet
                      </span>
                    )}
                    {b.status === "confirmed" && !secondDue && (
                      <span className="status-pill status-confirmed">Session Confirmed</span>
                    )}
                    {b.status === "completed" && (
                      <button className="btn btn-outline btn-small" onClick={() => setRatingFor(b._id)}>Rate Provider</button>
                    )}

                    {gateOpen && (
                      <>
                        <button
                          className="btn btn-outline btn-small"
                          onClick={() => navigate(`/messages/${b.provider._id}`)}
                        >
                          Message
                        </button>
                        <button
                          className="btn btn-outline btn-small"
                          onClick={() => startCall(b.provider._id, b.provider.name, "audio")}
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
                      <strong>{b.provider?.name}</strong> suggested: {proposal.date} {proposal.startTime}-{proposal.endTime}
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
                    <p>Waiting for {b.provider?.name} to respond to your suggestion: {proposal.date} {proposal.startTime}-{proposal.endTime}</p>
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

                {ratingFor === b._id && (
                  <div style={{ marginTop: 12, borderTop: "1px solid var(--pista-lighter)", paddingTop: 12 }}>
                    <div className="form-group">
                      <label>Rating</label>
                      <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
                        {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} stars</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Review (US-32)</label>
                      <textarea
                        rows={2}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder={`How was your session with ${b.provider?.name}?`}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-primary btn-small" onClick={() => submitRating(b)}>Submit Rating & Review</button>
                      <button className="btn btn-outline btn-small" onClick={() => setRatingFor(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};

export default Exchanges;

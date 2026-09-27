import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { useCall } from "../context/CallContext";

const StatusPill = ({ status }) => <span className={`status-pill status-${status}`}>{status}</span>;

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
              <div key={ex._id} className="list-card">
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
                  <Link className="btn btn-outline btn-small" to={`/exchanges/${ex._id}`}>Details</Link>
                </div>
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

            return (
              <div key={b._id} className="list-card" style={{ flexDirection: "column", alignItems: "stretch" }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                  <div className="list-card-main">
                    <h4>{b.listing?.skill}</h4>
                    <p>
                      With {b.provider?.name} ·{" "}
                      {b.slot?.date
                        ? `${b.slot.date} ${b.slot.startTime}-${b.slot.endTime}`
                        : b.status === "confirmed" || b.status === "completed"
                        ? "Waiting for provider to schedule a time"
                        : "Time to be scheduled after payment"}
                    </p>
                    <p>
                      Price: ₹{b.price}
                      {" · "}
                      Payment:{" "}
                      <span className={`status-pill status-${firstPaid ? "paid" : "unpaid"}`}>
                        {fullyPaid ? "fully paid" : firstPaid ? "first payment done" : "unpaid"}
                      </span>
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
                      <span className="status-pill" title="Opens once the provider marks the session completed">
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
                      <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
                    </div>
                    <button className="btn btn-primary btn-small" onClick={() => submitRating(b)}>Submit Rating & Review</button>
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

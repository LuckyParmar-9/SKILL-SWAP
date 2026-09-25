import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

const StatusPill = ({ status }) => <span className={`status-pill status-${status}`}>{status}</span>;

const MyLearning = () => {
  const [bookings, setBookings] = useState([]);
  const [ratingFor, setRatingFor] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const load = () => api.get("/bookings/mine").then((res) => setBookings(res.data));
  useEffect(() => { load(); }, []);

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
    load();
  };

  return (
    <div className="page">
      <h1 className="page-title">My Learning</h1>
      <p className="page-sub">Track your paid learning bookings, payments, and sessions.</p>

      {bookings.length === 0 && <p className="empty-state">No bookings yet. <Link to="/paid-providers">Browse paid learning</Link></p>}

      {bookings.map((b) => (
        <div key={b._id} className="list-card" style={{ flexDirection: "column", alignItems: "stretch" }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div className="list-card-main">
              <h4>{b.listing?.skill}</h4>
              <p>With {b.provider?.name} · {b.slot?.date} {b.slot?.startTime}-{b.slot?.endTime}</p>
              <p>Price: ₹{b.price} · Payment: <span className={`status-pill status-${b.payment?.status}`}>{b.payment?.status}</span></p>
            </div>
            <div className="list-card-actions">
              <StatusPill status={b.status} />
              {b.status === "accepted" && b.payment.status !== "paid" && (
                <Link className="btn btn-primary btn-small" to={`/booking/${b._id}`}>Pay Now (US-27)</Link>
              )}
              {b.status === "confirmed" && (
                <span className="status-pill status-confirmed">Session Confirmed</span>
              )}
              {b.status === "completed" && (
                <button className="btn btn-outline btn-small" onClick={() => setRatingFor(b._id)}>Rate Provider</button>
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
      ))}
    </div>
  );
};

export default MyLearning;

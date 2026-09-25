import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

const StatusPill = ({ status }) => <span className={`status-pill status-${status}`}>{status}</span>;

const ProviderRequests = () => {
  const [bookings, setBookings] = useState([]);

  const load = () => api.get("/bookings/incoming").then((res) => setBookings(res.data)); // US-20
  useEffect(() => { load(); }, []);

  const respond = async (id, action) => {
    await api.put(`/bookings/${id}/respond`, { action }); // US-21
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

      {bookings.map((b) => (
        <div key={b._id} className="list-card">
          <div className="list-card-main">
            <h4>{b.listing?.skill} — ₹{b.price}</h4>
            <p>Learner: {b.learner?.name}</p>
            <p>Slot: {b.slot?.date} {b.slot?.startTime}-{b.slot?.endTime}</p>
          </div>
          <div className="list-card-actions">
            <StatusPill status={b.status} />
            {b.status === "pending" && (
              <>
                <button className="btn btn-primary btn-small" onClick={() => respond(b._id, "accept")}>Accept</button>
                <button className="btn btn-outline btn-small" onClick={() => respond(b._id, "reject")}>Reject</button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ProviderRequests;

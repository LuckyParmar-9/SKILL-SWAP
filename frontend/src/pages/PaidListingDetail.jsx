import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import Stars from "../components/Stars";

const PaidListingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    api.get(`/paid-listings/${id}`).then((res) => setListing(res.data));
  }, [id]);

  if (!listing) return <div className="loading">Loading listing...</div>;

  const availableSlots = listing.slots.filter((s) => !s.isBooked); // US-25

  const requestBooking = async () => {
    if (!selectedSlot) return;
    const { data } = await api.post("/bookings", { listingId: listing._id, slotId: selectedSlot }); // US-19
    setRequested(true);
    setTimeout(() => navigate(`/my-learning`), 1200);
  };

  return (
    <div className="page">
      <div className="card">
        <h2 style={{ margin: "0 0 6px" }}>{listing.skill}</h2>
        <p style={{ color: "var(--text-muted)" }}>{listing.category} · {listing.duration} min session</p>
        <p>{listing.description}</p>
        <p style={{ fontSize: 22, fontWeight: 800, color: "var(--pista-darker)" }}>₹{listing.price}</p>

        <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 10 }}>
          <div className="avatar">{listing.provider?.name?.[0]}</div>
          <div>
            <strong>{listing.provider?.name}</strong>
            <div><Stars rating={listing.provider?.ratingAvg} count={listing.provider?.ratingCount} /></div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3>Available time slots (US-25)</h3>
        {availableSlots.length === 0 && <p className="empty-state">No slots available right now.</p>}
        <div className="skill-list">
          {availableSlots.map((s) => (
            <button
              key={s._id}
              className={`chip ${selectedSlot === s._id ? "" : ""}`}
              style={{
                border: "none",
                cursor: "pointer",
                background: selectedSlot === s._id ? "var(--pista-dark)" : "var(--pista-light)",
                color: selectedSlot === s._id ? "white" : "var(--pista-darker)",
              }}
              onClick={() => setSelectedSlot(s._id)}
            >
              {s.date} · {s.startTime}-{s.endTime}
            </button>
          ))}
        </div>

        {requested ? (
          <p style={{ color: "var(--pista-darker)", marginTop: 16 }}>Request sent! Redirecting to My Learning...</p>
        ) : (
          <button className="btn btn-primary" style={{ marginTop: 16 }} disabled={!selectedSlot} onClick={requestBooking}>
            Request This Session
          </button>
        )}
      </div>
    </div>
  );
};

export default PaidListingDetail;

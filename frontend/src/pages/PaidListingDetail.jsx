import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import Stars from "../components/Stars";

const PaidListingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/paid-listings/${id}`).then((res) => setListing(res.data));
  }, [id]);

  if (!listing) return <div className="loading">Loading listing...</div>;

  const requestBooking = async () => {
    setError("");
    try {
      await api.post("/bookings", { listingId: listing._id }); // US-19
      setRequested(true);
      setTimeout(() => navigate(`/my-learning`), 1200);
    } catch (err) {
      setError(err.response?.data?.message || "Could not send the request");
    }
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
        <h3>How this works</h3>
        <p style={{ color: "var(--text-muted)" }}>
          Send a request to {listing.provider?.name}. Once they accept and you complete your first payment,
          they'll schedule the exact session date and time with you.
        </p>

        {requested ? (
          <p style={{ color: "var(--pista-darker)", marginTop: 16 }}>Request sent! Redirecting to My Learning...</p>
        ) : (
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={requestBooking}>
            Request This Session
          </button>
        )}

        {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}
      </div>
    </div>
  );
};

export default PaidListingDetail;

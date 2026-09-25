import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";

const ExchangeDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [exchange, setExchange] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [rated, setRated] = useState(false);

  const load = () => api.get(`/exchanges/${id}`).then((res) => setExchange(res.data));
  useEffect(() => { load(); }, [id]);

  if (!exchange) return <div className="loading">Loading...</div>;

  const other = String(exchange.receiver._id) === String(user._id) ? exchange.requester : exchange.receiver;

  const submitRating = async (e) => {
    e.preventDefault();
    await api.post("/reviews", {
      providerId: other._id,
      type: "exchange",
      refId: exchange._id,
      rating,
      comment,
    });
    setRated(true);
  };

  return (
    <div className="page">
      <h1 className="page-title">Exchange Details</h1>
      <div className="card">
        <p><strong>You offer:</strong> {exchange.requesterSkill}</p>
        <p><strong>You receive:</strong> {exchange.receiverSkill}</p>
        <p><strong>With:</strong> {other.name} ({other.email})</p>
        <p><strong>Status:</strong> <span className={`status-pill status-${exchange.status}`}>{exchange.status}</span></p>
        {exchange.message && <p><strong>Message:</strong> {exchange.message}</p>}
        <Link className="btn btn-outline btn-small" to={`/messages/${other._id}`}>Message {other.name}</Link>
      </div>

      {exchange.status === "completed" && (
        <div className="card" style={{ marginTop: 20 }}>
          <h3>Rate this exchange (US-33)</h3>
          {rated ? (
            <p style={{ color: "var(--pista-darker)" }}>Thanks for your feedback!</p>
          ) : (
            <form onSubmit={submitRating}>
              <div className="form-group">
                <label>Rating</label>
                <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
                  {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} stars</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Comment</label>
                <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
              </div>
              <button className="btn btn-primary">Submit Rating</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

export default ExchangeDetail;

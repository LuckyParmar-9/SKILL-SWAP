import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";

const StatusPill = ({ status }) => <span className={`status-pill status-${status}`}>{status}</span>;

const Exchanges = () => {
  const { user } = useAuth();
  const [exchanges, setExchanges] = useState([]);
  const [filter, setFilter] = useState("all");

  const load = () => api.get("/exchanges").then((res) => setExchanges(res.data));
  useEffect(() => { load(); }, []);

  const act = async (id, action) => {
    await api.put(`/exchanges/${id}/${action}`);
    load();
  };

  const filtered = filter === "all" ? exchanges : exchanges.filter((e) => e.status === filter);

  return (
    <div className="page">
      <h1 className="page-title">Skill Exchanges</h1>
      <p className="page-sub">Manage exchange requests you've sent and received.</p>

      <div className="tabs" style={{ marginBottom: 6 }}>
        <span className="tab active">Free Exchanges</span>
        <Link to="/my-learning" className="tab">Paid Learning Requests</Link>
      </div>

      <div className="tabs">
        {["all", "pending", "active", "completed", "rejected", "cancelled"].map((f) => (
          <button key={f} className={`tab ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      {filtered.length === 0 && <p className="empty-state">No exchanges here. <Link to="/matches">Find a match</Link> to get started.</p>}

      {filtered.map((ex) => {
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
    </div>
  );
};

export default Exchanges;

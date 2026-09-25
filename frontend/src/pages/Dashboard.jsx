import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import Stars from "../components/Stars";

const StatusPill = ({ status }) => <span className={`status-pill status-${status}`}>{status}</span>;

const Dashboard = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/dashboard").then((res) => setData(res.data));
  }, []);

  if (!data) return <div className="loading">Loading dashboard...</div>;

  return (
    <div className="page">
      <h1 className="page-title">Your Dashboard</h1>
      <p className="page-sub">
        Everything happening on SkillSwap, in one place.{" "}
        <Stars rating={data.profile.ratingAvg} count={data.profile.ratingCount} />
      </p>

      <div className="grid-3" style={{ marginBottom: 30 }}>
        <div className="feature-card">
          <div className="icon">🎓</div>
          <h3>{data.profile.offeredSkills.length}</h3>
          <p>Skills you offer</p>
        </div>
        <div className="feature-card">
          <div className="icon">🎯</div>
          <h3>{data.profile.wantedSkills.length}</h3>
          <p>Skills you want to learn</p>
        </div>
        <div className="feature-card">
          <div className="icon">🔔</div>
          <h3>{data.unreadNotifications}</h3>
          <p>Unread notifications</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Recent Exchanges</h3>
          {data.exchanges.length === 0 && <p className="empty-state">No exchanges yet. <Link to="/matches">Find a match</Link></p>}
          {data.exchanges.map((ex) => (
            <div key={ex._id} className="list-card">
              <div className="list-card-main">
                <h4>{ex.requesterSkill} ⇄ {ex.receiverSkill}</h4>
                <p>With {ex.requester.name === undefined ? "" : ex.requester.name} / {ex.receiver.name}</p>
              </div>
              <div className="list-card-actions">
                <StatusPill status={ex.status} />
                <Link className="btn btn-outline btn-small" to={`/exchanges/${ex._id}`}>View</Link>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h3>Paid Learning (as learner)</h3>
          {data.learningAsLearner.length === 0 && <p className="empty-state">No bookings yet. <Link to="/paid-providers">Browse providers</Link></p>}
          {data.learningAsLearner.map((b) => (
            <div key={b._id} className="list-card">
              <div className="list-card-main">
                <h4>{b.listing?.skill}</h4>
                <p>With {b.provider?.name}</p>
              </div>
              <div className="list-card-actions">
                <StatusPill status={b.status} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {data.learningAsProvider.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <h3>Paid Learning (as provider)</h3>
          {data.learningAsProvider.map((b) => (
            <div key={b._id} className="list-card">
              <div className="list-card-main">
                <h4>{b.listing?.skill}</h4>
                <p>Learner: {b.learner?.name}</p>
              </div>
              <div className="list-card-actions">
                <StatusPill status={b.status} />
                <Link className="btn btn-outline btn-small" to="/provider/requests">Manage</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import Stars from "../components/Stars";

const Matches = () => {
  const [matches, setMatches] = useState(null);
  const [info, setInfo] = useState("");

  useEffect(() => {
    api.get("/matches").then((res) => {
      setMatches(res.data.matches || []);
      setInfo(res.data.message || "");
    });
  }, []);

  if (!matches) return <div className="loading">Finding matches...</div>;

  return (
    <div className="page">
      <h1 className="page-title">Your Matches</h1>
      <p className="page-sub">People whose offered skills match what you want to learn.</p>

      {info && <p className="empty-state">{info}</p>}
      {!info && matches.length === 0 && <p className="empty-state">No matches found yet. Try adding more wanted skills.</p>}

      {matches.map((m) => (
        <div key={m.user._id} className="list-card">
          <div style={{ display: "flex", gap: 14, alignItems: "center", flex: 1 }}>
            <div className="avatar">{m.user.name?.[0]}</div>
            <div className="list-card-main">
              <h4>{m.user.name} {m.isMutual && <span className="chip">🔁 Mutual match</span>}</h4>
              <p>{m.user.location}</p>
              <Stars rating={m.user.ratingAvg} count={m.user.ratingCount} />
              <div className="skill-list" style={{ marginTop: 6 }}>
                {m.theyOfferIWant.map((s) => <span key={s._id} className="chip">Teaches: {s.skill}</span>)}
              </div>
            </div>
          </div>
          <div className="list-card-actions">
            <Link className="btn btn-outline btn-small" to={`/provider/${m.user._id}`}>View Profile</Link>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Matches;

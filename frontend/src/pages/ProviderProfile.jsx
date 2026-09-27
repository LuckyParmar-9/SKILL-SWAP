import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import Stars from "../components/Stars";
import { useAuth } from "../context/AuthContext";
import { useCall } from "../context/CallContext";

const ProviderProfile = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { startCall, callState } = useCall();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [showRequest, setShowRequest] = useState(false);
  const [myOfferedSkill, setMyOfferedSkill] = useState("");
  const [theirSkill, setTheirSkill] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    api.get(`/users/${id}`).then((res) => setProfile(res.data));
  }, [id]);

  if (!profile) return <div className="loading">Loading profile...</div>;
  const { user: provider, reviews } = profile;

  const sendRequest = async (e) => {
    e.preventDefault();
    await api.post("/exchanges", {
      receiverId: provider._id,
      requesterSkill: myOfferedSkill,
      receiverSkill: theirSkill,
      message,
    });
    setSent(true);
  };

  return (
    <div className="page">
      <div className="card" style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <div className="avatar" style={{ width: 70, height: 70, fontSize: 26 }}>{provider.name?.[0]}</div>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: "0 0 4px" }}>{provider.name}</h2>
          {(provider.age || provider.gender) && (
            <p style={{ margin: "2px 0", color: "var(--text-muted)", fontSize: 14 }}>
              {[provider.age, provider.gender].filter(Boolean).join(" · ")}
            </p>
          )}
          <p style={{ color: "var(--text-muted)" }}>{provider.location}</p>
          <Stars rating={provider.ratingAvg} count={provider.ratingCount} />
          <p style={{ marginTop: 8 }}>{provider.bio}</p>
        </div>
        {user?._id !== provider._id && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={() => setShowRequest(true)}>Request Exchange</button>
            <button className="btn btn-outline" onClick={() => navigate(`/messages/${provider._id}`)}>Message</button>
            <button className="btn btn-outline" disabled={callState !== "idle"} onClick={() => startCall(provider._id, provider.name, "audio")}>🎤 Call</button>
            <button className="btn btn-outline" disabled={callState !== "idle"} onClick={() => startCall(provider._id, provider.name, "video")}>📹 Video</button>
          </div>
        )}
      </div>

      {showRequest && (
        <div className="card" style={{ marginTop: 20 }}>
          <h3>Send a skill exchange request</h3>
          {sent ? (
            <p style={{ color: "var(--pista-darker)" }}>Request sent! Track it in your Exchanges tab.</p>
          ) : (
            <form onSubmit={sendRequest}>
              <div className="form-group">
                <label>Skill you'll offer them</label>
                <input required value={myOfferedSkill} onChange={(e) => setMyOfferedSkill(e.target.value)} placeholder="e.g. Excel" />
              </div>
              <div className="form-group">
                <label>Skill you want from them</label>
                <select required value={theirSkill} onChange={(e) => setTheirSkill(e.target.value)}>
                  <option value="">Select a skill</option>
                  {provider.offeredSkills.map((s) => <option key={s._id} value={s.skill}>{s.skill}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Message (optional)</label>
                <textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />
              </div>
              <button className="btn btn-primary">Send Request</button>
            </form>
          )}
        </div>
      )}

      <div className="grid-2" style={{ marginTop: 24 }}>
        <div className="card">
          <h3>Skills offered</h3>
          <div className="skill-list">
            {provider.offeredSkills.map((s) => <span key={s._id} className="chip">{s.skill} · {s.level}</span>)}
          </div>
        </div>
        <div className="card">
          <h3>Reviews ({reviews.length})</h3>
          {reviews.length === 0 && <p className="empty-state">No reviews yet.</p>}
          {reviews.map((r) => (
            <div key={r._id} style={{ borderBottom: "1px solid var(--pista-lighter)", padding: "10px 0" }}>
              <Stars rating={r.rating} />
              <p style={{ margin: "4px 0", fontSize: 14 }}>{r.comment}</p>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>— {r.reviewer?.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProviderProfile;

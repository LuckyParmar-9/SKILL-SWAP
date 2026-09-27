import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api";

const SkillCard = ({ s }) => (
  <div className="list-card" style={{ flexDirection: "column", alignItems: "stretch" }}>
    <h4 style={{ margin: "0 0 4px" }}>{s.skill}</h4>
    <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>
      {s.category}{s.subCategory ? ` · ${s.subCategory}` : ""} · {s.level} · {s.mode} · {s.language}
    </p>
    {s.description && <p style={{ marginTop: 6 }}>{s.description}</p>}
  </div>
);

const AdminUserProfile = () => {
  const { id } = useParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/users/${id}`).then((res) => setData(res.data));
  }, [id]);

  if (!data) return <div className="loading">Loading profile...</div>;

  const { user } = data;

  return (
    <div className="page">
      <p style={{ marginBottom: 16 }}>
        <Link to="/admin" className="btn btn-outline btn-small">← Back to Admin Panel</Link>
      </p>

      <div className="card">
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div className="avatar" style={{ width: 56, height: 56, fontSize: 22 }}>{user.name?.[0]}</div>
          <div>
            <h2 style={{ margin: 0 }}>{user.name}</h2>
            <p style={{ margin: "2px 0", color: "var(--text-muted)" }}>{user.email}</p>
          </div>
          <span className={`status-pill status-${user.role}`}>{user.role}</span>
          <span className={`status-pill status-${user.status === "active" ? "active-account" : user.status}`}>
            {user.status}
          </span>
        </div>

        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          <p><strong>Age:</strong> {user.age ?? "—"}</p>
          <p><strong>Gender:</strong> {user.gender || "—"}</p>
          <p><strong>Location:</strong> {user.location || "—"}</p>
          <p><strong>Rating:</strong> {user.ratingAvg?.toFixed?.(1) ?? 0} ({user.ratingCount || 0} reviews)</p>
        </div>
        {user.bio && <p style={{ marginTop: 10 }}>{user.bio}</p>}

        {user.role === "expert" && user.expertProfile && (
          <div style={{ marginTop: 16, borderTop: "1px solid var(--pista-lighter)", paddingTop: 12 }}>
            <h3 style={{ marginTop: 0 }}>Expert Profile</h3>
            <p><strong>Qualification:</strong> {user.expertProfile.qualification}</p>
            <p><strong>Experience:</strong> {user.expertProfile.experience}</p>
            <p>
              <strong>Verification:</strong>{" "}
              <span className={`status-pill status-${user.expertProfile.verificationStatus}`}>
                {user.expertProfile.verificationStatus}
              </span>
            </p>
          </div>
        )}
      </div>

      <h3 style={{ marginTop: 28 }}>Skills Teaching (Offered)</h3>
      {(!user.offeredSkills || user.offeredSkills.length === 0) && (
        <p className="empty-state">No offered skills listed.</p>
      )}
      {user.offeredSkills?.map((s) => <SkillCard key={s._id} s={s} />)}

      <h3 style={{ marginTop: 28 }}>Skills Wanted</h3>
      {(!user.wantedSkills || user.wantedSkills.length === 0) && (
        <p className="empty-state">No wanted skills listed.</p>
      )}
      {user.wantedSkills?.map((s) => <SkillCard key={s._id} s={s} />)}
    </div>
  );
};

export default AdminUserProfile;

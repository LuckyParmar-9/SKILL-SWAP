import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import StatusPill from "../components/StatusPill";

const AdminDashboard = () => {
  const [tab, setTab] = useState("experts");
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [reports, setReports] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [experts, setExperts] = useState([]);
  const [expertFilter, setExpertFilter] = useState("pending");
  const [noteDrafts, setNoteDrafts] = useState({});
  const [newCategory, setNewCategory] = useState({ name: "", description: "", subCategories: "" });

  const loadUsers = () => api.get("/admin/users").then((res) => setUsers(res.data));
  const loadCategories = () => api.get("/admin/categories").then((res) => setCategories(res.data));
  const loadReports = () => api.get("/admin/reports").then((res) => setReports(res.data));
  const loadBookings = () => api.get("/admin/bookings").then((res) => setBookings(res.data));
  const loadExperts = (status = expertFilter) =>
    api.get("/admin/experts", { params: status === "all" ? {} : { status } }).then((res) => setExperts(res.data));

  useEffect(() => {
    if (tab === "users") loadUsers();
    if (tab === "categories") loadCategories();
    if (tab === "reports") loadReports();
    if (tab === "bookings") loadBookings();
    if (tab === "experts") loadExperts();
  }, [tab]);

  useEffect(() => {
    if (tab === "experts") loadExperts(expertFilter);
  }, [expertFilter]);

  const decideExpert = async (id, decision) => {
    await api.put(`/admin/experts/${id}/verify`, { decision, adminNote: noteDrafts[id] || "" }); // expert verification gate
    setNoteDrafts((prev) => ({ ...prev, [id]: "" }));
    loadExperts(expertFilter);
  };

  const setUserStatus = async (id, status) => {
    await api.put(`/admin/users/${id}/status`, { status }); // US-44
    loadUsers();
  };

  const addCategory = async (e) => {
    e.preventDefault();
    await api.post("/admin/categories", newCategory); // US-42
    setNewCategory({ name: "", description: "", subCategories: "" });
    loadCategories();
  };

  const removeCategory = async (id) => {
    await api.delete(`/admin/categories/${id}`);
    loadCategories();
  };

  const updateReportStatus = async (id, status) => {
    await api.put(`/admin/reports/${id}`, { status }); // US-43
    loadReports();
  };

  return (
    <div className="page">
      <h1 className="page-title">Admin Panel</h1>
      <p className="page-sub">Manage users, categories, reports, and paid-learning transactions.</p>

      <div className="tabs">
        {["experts", "users", "categories", "reports", "bookings"].map((t) => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === "experts" && (
        <>
          <div className="tabs" style={{ marginBottom: 16 }}>
            {["pending", "verified", "rejected", "all"].map((f) => (
              <button key={f} className={`tab ${expertFilter === f ? "active" : ""}`} onClick={() => setExpertFilter(f)}>{f}</button>
            ))}
          </div>
          {experts.length === 0 && <p className="empty-state">No expert applications here.</p>}
          {experts.map((ex) => (
            <div key={ex._id} className="list-card" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div className="list-card-main">
                  <h4>{ex.name} <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: 13 }}>({ex.email})</span></h4>
                  <p><strong>Qualification:</strong> {ex.expertProfile?.qualification}</p>
                  <p><strong>Experience:</strong> {ex.expertProfile?.experience}</p>
                  {ex.expertProfile?.certificateUrl ? (
                    <p><strong>Certificate:</strong> <a href={ex.expertProfile.certificateUrl} target="_blank" rel="noreferrer">{ex.expertProfile.certificateUrl}</a></p>
                  ) : (
                    <p style={{ color: "var(--text-muted)" }}>No certificate provided</p>
                  )}
                  <Link to={`/admin/users/${ex._id}`} className="btn btn-outline btn-small" style={{ marginTop: 6, display: "inline-block" }}>
                    View Full Profile
                  </Link>
                </div>
                <StatusPill status={ex.expertProfile?.verificationStatus === "verified" ? "verified" : ex.expertProfile?.verificationStatus === "rejected" ? "rejected" : "pending"}>
                  {ex.expertProfile?.verificationStatus}
                </StatusPill>
              </div>

              {ex.expertProfile?.verificationStatus === "pending" && (
                <div style={{ marginTop: 12, borderTop: "1px solid var(--pista-lighter)", paddingTop: 12 }}>
                  <div className="form-group">
                    <label>Admin note (shown to expert if rejected)</label>
                    <input
                      value={noteDrafts[ex._id] || ""}
                      onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [ex._id]: e.target.value }))}
                      placeholder="Optional reason / feedback"
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-primary btn-small" onClick={() => decideExpert(ex._id, "verified")}>Verify</button>
                    <button className="btn btn-danger btn-small" onClick={() => decideExpert(ex._id, "rejected")}>Reject</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {tab === "users" && (
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td><StatusPill status={u.status === "active" ? "active-account" : u.status}>{u.status}</StatusPill></td>
                <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Link to={`/admin/users/${u._id}`} className="btn btn-outline btn-small">View Profile</Link>
                  <button className="btn btn-outline btn-small" onClick={() => setUserStatus(u._id, "active")}>Activate</button>
                  <button className="btn btn-outline btn-small" onClick={() => setUserStatus(u._id, "suspended")}>Suspend</button>
                  <button className="btn btn-danger btn-small" onClick={() => setUserStatus(u._id, "blocked")}>Block</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === "categories" && (
        <>
          <div className="card" style={{ marginBottom: 20, maxWidth: 420 }}>
            <h3>Add category</h3>
            <form onSubmit={addCategory}>
              <div className="form-group">
                <label>Name</label>
                <input required value={newCategory.name} onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <input value={newCategory.description} onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Sub-categories (comma separated)</label>
                <input
                  value={newCategory.subCategories}
                  onChange={(e) => setNewCategory({ ...newCategory, subCategories: e.target.value })}
                  placeholder="e.g. Web Development, Mobile Apps, Data Science"
                />
              </div>
              <button className="btn btn-primary">Add Category</button>
            </form>
          </div>
          <table>
            <thead><tr><th>Name</th><th>Description</th><th>Sub-categories</th><th>Actions</th></tr></thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c._id}>
                  <td>{c.name}</td>
                  <td>{c.description}</td>
                  <td>{(c.subCategories || []).join(", ") || "—"}</td>
                  <td><button className="btn btn-danger btn-small" onClick={() => removeCategory(c._id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {tab === "reports" && (
        <table>
          <thead><tr><th>Reported By</th><th>Reported User</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r._id}>
                <td>{r.reportedBy?.name}</td>
                <td>{r.reportedUser?.name}</td>
                <td>{r.reason}</td>
                <td><StatusPill status={r.status === "pending" ? "pending" : "accepted"}>{r.status}</StatusPill></td>
                <td style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-outline btn-small" onClick={() => updateReportStatus(r._id, "reviewed")}>Mark Reviewed</button>
                  <button className="btn btn-primary btn-small" onClick={() => updateReportStatus(r._id, "resolved")}>Resolve</button>
                </td>
              </tr>
            ))}
            {reports.length === 0 && <tr><td colSpan={5} className="empty-state">No reports.</td></tr>}
          </tbody>
        </table>
      )}

      {tab === "bookings" && (
        <table>
          <thead><tr><th>Learner</th><th>Provider</th><th>Skill</th><th>Price</th><th>Status</th><th>Payment</th></tr></thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b._id}>
                <td>{b.learner?.name}</td>
                <td>{b.provider?.name}</td>
                <td>{b.listing?.skill}</td>
                <td>₹{b.price}</td>
                <td><StatusPill status={b.status} /></td>
                <td>
                  <StatusPill status={b.payment?.first?.status === "paid" ? "paid" : "unpaid"}>
                    {b.payment?.first?.status === "paid" ? "paid" : "unpaid"}
                  </StatusPill>
                </td>
              </tr>
            ))}
            {bookings.length === 0 && <tr><td colSpan={6} className="empty-state">No bookings.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default AdminDashboard;

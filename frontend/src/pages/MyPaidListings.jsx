import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";

const LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"];
const MODES = ["Online Voice", "Online Video", "Offline"];
const LANGUAGES = ["Hindi", "English", "Hinglish"];

const MyPaidListings = () => {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);
  const [form, setForm] = useState({
    skill: "",
    category: "",
    subCategory: "",
    level: "Beginner",
    mode: "Online Video",
    language: "English",
    description: "",
    price: "",
    duration: 60,
  });
  const [slotForms, setSlotForms] = useState({});
  const [error, setError] = useState("");

  const load = () => api.get("/paid-listings/mine").then((res) => setListings(res.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const isExpert = user?.role === "expert";
  const status = user?.expertProfile?.verificationStatus;
  const canPublish = isExpert && status === "verified";

  const createListing = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/paid-listings", form); // US-23, US-24 — requires verified expert
      setForm({
        skill: "",
        category: "",
        subCategory: "",
        level: "Beginner",
        mode: "Online Video",
        language: "English",
        description: "",
        price: "",
        duration: 60,
      });
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not create listing");
    }
  };

  const addSlot = async (listingId) => {
    const slot = slotForms[listingId];
    if (!slot?.date || !slot?.startTime || !slot?.endTime) return;
    try {
      await api.post(`/paid-listings/${listingId}/slots`, slot); // US-22
      setSlotForms((prev) => ({ ...prev, [listingId]: { date: "", startTime: "", endTime: "" } }));
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not add slot");
    }
  };

  const updateSlotForm = (listingId, field, value) => {
    setSlotForms((prev) => ({ ...prev, [listingId]: { ...prev[listingId], [field]: value } }));
  };

  return (
    <div className="page">
      <h1 className="page-title">My Paid Learning Listings</h1>
      <p className="page-sub">Offer paid sessions when a free skill swap isn't available.</p>

      {!isExpert && (
        <div className="card" style={{ marginBottom: 26, background: "var(--pista-lighter)" }}>
          <h3>Want to teach paid sessions?</h3>
          <p>Only verified Expert accounts can publish paid listings. Regular accounts can still book paid sessions as a learner.</p>
          <Link className="btn btn-primary btn-small" to="/register-expert">Apply as an Expert</Link>
        </div>
      )}

      {isExpert && status === "pending" && (
        <div className="card" style={{ marginBottom: 26, background: "#fff3cd" }}>
          <h3>⏳ Verification pending</h3>
          <p>Your qualification and experience are under admin review. You'll be notified once approved — then you can publish listings.</p>
        </div>
      )}

      {isExpert && status === "rejected" && (
        <div className="card" style={{ marginBottom: 26, background: "#fbe4e1" }}>
          <h3>Verification rejected</h3>
          <p>{user.expertProfile?.adminNote || "Your expert application was not approved."}</p>
        </div>
      )}

      {isExpert && status === "verified" && (
        <div className="card" style={{ marginBottom: 26, background: "var(--pista-light)" }}>
          <h3>✅ Verified Expert</h3>
          <p>You're approved to publish paid learning listings.</p>
        </div>
      )}

      {error && <div className="form-error">{error}</div>}

      <div className="card" style={{ marginBottom: 26, opacity: canPublish ? 1 : 0.6 }}>
        <h3>Create a new listing</h3>
        <fieldset disabled={!canPublish} style={{ border: "none", padding: 0, margin: 0 }}>
        <form onSubmit={createListing}>
          <div className="form-group">
            <label>Skill name</label>
            <input required placeholder="e.g. Guitar" value={form.skill} onChange={(e) => setForm({ ...form, skill: e.target.value })} />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label>Category</label>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Sub-category</label>
              <input value={form.subCategory} onChange={(e) => setForm({ ...form, subCategory: e.target.value })} />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label>Your level</label>
              <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Mode</label>
              <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Language</label>
            <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
              {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Session details</label>
            <textarea required rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label>Price (₹)</label>
              <input required type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Duration (minutes)</label>
              <input type="number" min="15" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
            </div>
          </div>
          <button className="btn btn-primary">Create Listing</button>
        </form>
        </fieldset>
      </div>

      {listings.map((l) => (
        <div key={l._id} className="card" style={{ marginBottom: 16 }}>
          <h4>{l.skill} — ₹{l.price} / {l.duration} min</h4>
          <p style={{ color: "var(--text-muted)" }}>
            {l.category}{l.subCategory && ` · ${l.subCategory}`} · {l.level} · {l.mode} · {l.language}
          </p>
          <p style={{ color: "var(--text-muted)" }}>{l.description}</p>
          <p><strong>Slots:</strong> {l.slots.length === 0 ? "None added" : l.slots.map((s) => `${s.date} ${s.startTime}${s.isBooked ? " (booked)" : ""}`).join(", ")}</p>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <input type="date" value={slotForms[l._id]?.date || ""} onChange={(e) => updateSlotForm(l._id, "date", e.target.value)} style={{ width: 150 }} />
            <input type="time" value={slotForms[l._id]?.startTime || ""} onChange={(e) => updateSlotForm(l._id, "startTime", e.target.value)} style={{ width: 120 }} />
            <input type="time" value={slotForms[l._id]?.endTime || ""} onChange={(e) => updateSlotForm(l._id, "endTime", e.target.value)} style={{ width: 120 }} />
            <button className="btn btn-outline btn-small" onClick={() => addSlot(l._id)}>Add Slot</button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MyPaidListings;

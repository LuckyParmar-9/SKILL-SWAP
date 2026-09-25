import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";

const LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"];
const MODES = ["Online Voice", "Online Video", "Offline"];
const LANGUAGES = ["Hindi", "English", "Hinglish"];
const GENDERS = ["Male", "Female", "Other", "Prefer not to say"];

const emptySkillForm = { skill: "", category: "", subCategory: "", level: "Beginner", mode: "Online Video", language: "English", description: "" };

const Profile = () => {
  const { user, setUser, reload } = useAuth();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    name: user?.name || "",
    age: user?.age || "",
    gender: user?.gender || "",
    email: user?.email || "",
    bio: user?.bio || "",
    location: user?.location || "",
  });
  const [savedMsg, setSavedMsg] = useState("");
  const [profileError, setProfileError] = useState("");
  const [offeredForm, setOfferedForm] = useState(emptySkillForm);
  const [wantedForm, setWantedForm] = useState(emptySkillForm);

  useEffect(() => {
    api.get("/categories").then((res) => setCategories(res.data)).catch(() => { });
  }, []);

  if (!user) return <div className="loading">Loading profile...</div>;

  const subCategoriesFor = (categoryName) => categories.find((c) => c.name === categoryName)?.subCategories || [];

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileError("");
    try {
      const { data } = await api.put("/users/profile", form);
      setUser(data);
      setSavedMsg("Profile updated!");
      setTimeout(() => setSavedMsg(""), 2000);
    } catch (err) {
      setProfileError(err.response?.data?.message || "Could not update profile");
    }
  };

  const addOffered = async (e) => {
    e.preventDefault();
    if (!offeredForm.skill) return;
    await api.post("/users/skills/offered", offeredForm);
    setOfferedForm(emptySkillForm);
    reload();
  };

  const addWanted = async (e) => {
    e.preventDefault();
    if (!wantedForm.skill) return;
    await api.post("/users/skills/wanted", wantedForm);
    setWantedForm(emptySkillForm);
    reload();
  };

  const updateLevel = async (listType, skillId, level) => {
    await api.put(`/users/skills/${listType}/${skillId}/level`, { level });
    reload();
  };

  const removeSkill = async (listType, skillId) => {
    await api.delete(`/users/skills/${listType}/${skillId}`);
    reload();
  };

  return (
    <div className="page">
      <h1 className="page-title">My Profile</h1>
      <p className="page-sub">Keep your info and skills up to date so others can find and match with you.</p>

      {user.role === "expert" && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3>Expert Verification Status</h3>
          <p>
            <span className={`status-pill status-${user.expertProfile?.verificationStatus === "verified" ? "verified" : user.expertProfile?.verificationStatus === "rejected" ? "rejected" : "pending"}`}>
              {user.expertProfile?.verificationStatus}
            </span>
          </p>
          <p><strong>Qualification:</strong> {user.expertProfile?.qualification}</p>
          <p><strong>Experience:</strong> {user.expertProfile?.experience}</p>
          {user.expertProfile?.verificationStatus === "rejected" && user.expertProfile?.adminNote && (
            <p style={{ color: "var(--danger)" }}>Admin note: {user.expertProfile.adminNote}</p>
          )}
        </div>
      )}
      {user.role === "user" && (
        <p style={{ marginBottom: 20 }}>
          Want to teach paid sessions? <Link to="/register-expert" style={{ color: "var(--pista-darker)", fontWeight: 600 }}>Apply as an Expert</Link>
        </p>
      )}

      <div className="grid-2">
        <div className="card">
          <h3>Basic info</h3>
          {savedMsg && <div style={{ color: "var(--pista-darker)", marginBottom: 10 }}>{savedMsg}</div>}
          {profileError && <div className="form-error">{profileError}</div>}
          <form onSubmit={saveProfile}>
            <div className="form-group">
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Age</label>
                <input type="number" min="13" max="120" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Gender</label>
                <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  <option value="">Prefer not to say</option>
                  {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Location</label>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="City, Country" />
            </div>
            <div className="form-group">
              <label>Bio</label>
              <textarea rows={4} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Tell others about yourself..." />
            </div>
            <button className="btn btn-primary">Save Profile</button>
          </form>
        </div>

        <div className="card">
          <h3>Add a skill you can teach </h3>
          <form onSubmit={addOffered}>
            <div className="form-group">
              <label>Skill name</label>
              <input required value={offeredForm.skill} onChange={(e) => setOfferedForm({ ...offeredForm, skill: e.target.value })} placeholder="e.g. Guitar" />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Category</label>
                <select value={offeredForm.category} onChange={(e) => setOfferedForm({ ...offeredForm, category: e.target.value, subCategory: "" })}>
                  <option value="">Select category</option>
                  {categories.map((c) => <option key={c._id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Sub-category</label>
                <select value={offeredForm.subCategory} onChange={(e) => setOfferedForm({ ...offeredForm, subCategory: e.target.value })} disabled={!offeredForm.category}>
                  <option value="">Select sub-category</option>
                  {subCategoriesFor(offeredForm.category).map((sc) => <option key={sc} value={sc}>{sc}</option>)}
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Your level</label>
                <select value={offeredForm.level} onChange={(e) => setOfferedForm({ ...offeredForm, level: e.target.value })}>
                  {LEVELS.map((l) => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Mode</label>
                <select value={offeredForm.mode} onChange={(e) => setOfferedForm({ ...offeredForm, mode: e.target.value })}>
                  {MODES.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Language</label>
              <select value={offeredForm.language} onChange={(e) => setOfferedForm({ ...offeredForm, language: e.target.value })}>
                {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea rows={2} value={offeredForm.description} onChange={(e) => setOfferedForm({ ...offeredForm, description: e.target.value })} />
            </div>
            <button className="btn btn-primary">Add Offered Skill</button>
          </form>

          <h4 style={{ marginTop: 20 }}>Add a skill you want to learn </h4>
          <form onSubmit={addWanted}>
            <div className="form-group">
              <label>Skill name</label>
              <input required value={wantedForm.skill} onChange={(e) => setWantedForm({ ...wantedForm, skill: e.target.value })} placeholder="e.g. Spanish" />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Category</label>
                <select value={wantedForm.category} onChange={(e) => setWantedForm({ ...wantedForm, category: e.target.value, subCategory: "" })}>
                  <option value="">Select category</option>
                  {categories.map((c) => <option key={c._id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Sub-category</label>
                <select value={wantedForm.subCategory} onChange={(e) => setWantedForm({ ...wantedForm, subCategory: e.target.value })} disabled={!wantedForm.category}>
                  <option value="">Select sub-category</option>
                  {subCategoriesFor(wantedForm.category).map((sc) => <option key={sc} value={sc}>{sc}</option>)}
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Desired level</label>
                <select value={wantedForm.level} onChange={(e) => setWantedForm({ ...wantedForm, level: e.target.value })}>
                  {LEVELS.map((l) => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Preferred mode</label>
                <select value={wantedForm.mode} onChange={(e) => setWantedForm({ ...wantedForm, mode: e.target.value })}>
                  {MODES.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Preferred language</label>
              <select value={wantedForm.language} onChange={(e) => setWantedForm({ ...wantedForm, language: e.target.value })}>
                {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
            <button className="btn btn-outline">Add Wanted Skill</button>
          </form>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 24 }}>
        <div className="card">
          <h3>Skills I offer</h3>
          {user.offeredSkills?.length === 0 && <p className="empty-state">No offered skills yet.</p>}
          {user.offeredSkills?.map((s) => (
            <div key={s._id} className="list-card">
              <div className="list-card-main">
                <h4>{s.skill}</h4>
                <p>{s.category}{s.subCategory ? ` · ${s.subCategory}` : ""}</p>
                <p>{s.mode} · {s.language}{s.description ? ` · ${s.description}` : ""}</p>
              </div>
              <div className="list-card-actions">
                <select value={s.level} onChange={(e) => updateLevel("offered", s._id, e.target.value)}>
                  {LEVELS.map((l) => <option key={l}>{l}</option>)}
                </select>
                <button className="btn btn-outline btn-small" onClick={() => removeSkill("offered", s._id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h3>Skills I want to learn</h3>
          {user.wantedSkills?.length === 0 && <p className="empty-state">No wanted skills yet.</p>}
          {user.wantedSkills?.map((s) => (
            <div key={s._id} className="list-card">
              <div className="list-card-main">
                <h4>{s.skill}</h4>
                <p>{s.category}{s.subCategory ? ` · ${s.subCategory}` : ""}</p>
                <p>{s.mode} · {s.language}</p>
              </div>
              <div className="list-card-actions">
                <select value={s.level} onChange={(e) => updateLevel("wanted", s._id, e.target.value)}>
                  {LEVELS.map((l) => <option key={l}>{l}</option>)}
                </select>
                <button className="btn btn-outline btn-small" onClick={() => removeSkill("wanted", s._id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Profile;

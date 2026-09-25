import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import Stars from "../components/Stars";

const MODES = ["Online Voice", "Online Video", "Offline"];
const LANGUAGES = ["Hindi", "English", "Hinglish"];

const Search = () => {
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [mode, setMode] = useState("");
  const [language, setLanguage] = useState("");
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    api.get("/categories").then((res) => setCategories(res.data)).catch(() => {});
  }, []);

  const subCategories = categories.find((c) => c.name === category)?.subCategories || [];

  const search = async (e) => {
    e?.preventDefault();
    const params = {};
    if (q) params.q = q;
    if (category) params.category = category;
    if (subCategory) params.subCategory = subCategory;
    if (mode) params.mode = mode;
    if (language) params.language = language;
    const { data } = await api.get("/users/search", { params });
    setResults(data);
    setSearched(true);
  };

  const clearFilters = () => {
    setCategory(""); setSubCategory(""); setMode(""); setLanguage("");
  };

  const matchesSkill = (s) =>
    (!q || s.skill.toLowerCase().includes(q.toLowerCase())) &&
    (!category || s.category === category) &&
    (!subCategory || s.subCategory === subCategory) &&
    (!mode || s.mode === mode) &&
    (!language || s.language === language);

  return (
    <div className="page">
      <h1 className="page-title">Find a skill</h1>
      <p className="page-sub">Search for a skill and filter by category, mode and language.</p>

      <form onSubmit={search} className="card" style={{ marginBottom: 26, maxWidth: 720 }}>
        <div className="form-group">
          <label>Skill name</label>
          <input placeholder="e.g. Photography, Python, Guitar..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label>Category</label>
            <select value={category} onChange={(e) => { setCategory(e.target.value); setSubCategory(""); }}>
              <option value="">All categories</option>
              {categories.map((c) => <option key={c._id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Sub-category</label>
            <select value={subCategory} onChange={(e) => setSubCategory(e.target.value)} disabled={!category}>
              <option value="">All sub-categories</option>
              {subCategories.map((sc) => <option key={sc} value={sc}>{sc}</option>)}
            </select>
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label>Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="">Any mode</option>
              {MODES.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="">Any language</option>
              {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-primary">Search</button>
          <button type="button" className="btn btn-outline" onClick={clearFilters}>Clear filters</button>
        </div>
      </form>

      {searched && results.length === 0 && <p className="empty-state">No providers found for your search.</p>}

      {results.map((u) => (
        <div key={u._id} className="list-card">
          <div style={{ display: "flex", gap: 14, alignItems: "center", flex: 1 }}>
            <div className="avatar">{u.name?.[0]}</div>
            <div className="list-card-main">
              <h4>{u.name}</h4>
              <p>{u.location}</p>
              <Stars rating={u.ratingAvg} count={u.ratingCount} />
              <div className="skill-list" style={{ marginTop: 6 }}>
                {u.offeredSkills
                  .filter(matchesSkill)
                  .map((s) => (
                    <span key={s._id} className="chip">
                      {s.skill}{s.subCategory ? ` (${s.subCategory})` : ""} · {s.level} · {s.mode} · {s.language}
                    </span>
                  ))}
              </div>
            </div>
          </div>
          <div className="list-card-actions">
            <Link className="btn btn-outline btn-small" to={`/provider/${u._id}`}>View Profile</Link>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Search;

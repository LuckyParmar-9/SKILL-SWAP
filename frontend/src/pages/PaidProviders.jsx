import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import Stars from "../components/Stars";

const PaidProviders = () => {
  const [skill, setSkill] = useState("");
  const [listings, setListings] = useState([]);

  const load = (skillFilter = "") =>
    api.get("/paid-listings", { params: skillFilter ? { skill: skillFilter } : {} }).then((res) => setListings(res.data));

  useEffect(() => { load(); }, []);

  const search = (e) => {
    e.preventDefault();
    load(skill);
  };

  return (
    <div className="page">
      <h1 className="page-title">Paid Learning</h1>
      <p className="page-sub">Can't find a free swap partner? Book a paid session with an expert instead.</p>

      <form onSubmit={search} style={{ display: "flex", gap: 10, marginBottom: 26, maxWidth: 500 }}>
        <input placeholder="Search by skill..." value={skill} onChange={(e) => setSkill(e.target.value)} />
        <button className="btn btn-primary">Search</button>
      </form>

      {listings.length === 0 && <p className="empty-state">No paid listings found.</p>}

      <div className="grid-3">
        {listings.map((l) => (
          <div key={l._id} className="card">
            <h3 style={{ margin: "0 0 6px" }}>{l.skill}</h3>
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{l.description?.slice(0, 90)}...</p>
            <p><Stars rating={l.provider?.ratingAvg} count={l.provider?.ratingCount} /></p>
            <p style={{ fontWeight: 700, color: "var(--pista-darker)" }}>₹{l.price} / {l.duration} min</p>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>By {l.provider?.name}</p>
            <Link className="btn btn-primary btn-small" to={`/paid-listings/${l._id}`}>View Details</Link>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PaidProviders;

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const RegisterExpert = () => {
  const { registerExpert } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    qualification: "",
    experience: "",
    certificateUrl: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await registerExpert(form);
      navigate("/my-paid-listings");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-page" style={{ maxWidth: 480 }}>
      <h2>Become a SkillSwap Expert 🎓</h2>
      <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: -8, marginBottom: 18 }}>
        Teach paid sessions on SkillSwap. Expert accounts go through a quick admin
        review of your qualification and experience before you can publish listings.
      </p>
      {error && <div className="form-error">{error}</div>}
      <form onSubmit={submit}>
        <div className="form-group">
          <label>Full Name</label>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Qualification</label>
          <input
            required
            value={form.qualification}
            onChange={(e) => setForm({ ...form, qualification: e.target.value })}
            placeholder="e.g. B.Tech CSE, Certified AWS Solutions Architect"
          />
        </div>
        <div className="form-group">
          <label>Experience</label>
          <textarea
            required
            rows={3}
            value={form.experience}
            onChange={(e) => setForm({ ...form, experience: e.target.value })}
            placeholder="e.g. 5 years teaching web development, 3 years as a professional guitarist"
          />
        </div>
        <div className="form-group">
          <label>Certificate link (optional)</label>
          <input
            value={form.certificateUrl}
            onChange={(e) => setForm({ ...form, certificateUrl: e.target.value })}
            placeholder="Link to certificate, portfolio or LinkedIn (Google Drive, etc.)"
          />
        </div>
        <button className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
          {loading ? "Submitting..." : "Submit for Verification"}
        </button>
      </form>
      <div className="form-footer-link">
        Just want to learn or swap skills? <Link to="/register">Register as a regular user</Link>
      </div>
      <div className="form-footer-link">
        Already have an account? <Link to="/login">Login</Link>
      </div>
    </div>
  );
};

export default RegisterExpert;

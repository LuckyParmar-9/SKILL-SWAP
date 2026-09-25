import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Landing = () => {
  const { user } = useAuth();

  return (
    <div>
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-text">
            <span className="hero-badge">🌱 Learn. Teach. Grow — together.</span>
            <h1>Swap skills, <span>not money.</span></h1>
            <p>
              SkillSwap connects people who want to trade knowledge — teach what you know,
              learn what you don't. Can't find a swap partner? Book a paid session instead.
            </p>
            <div className="hero-actions">
              {user ? (
                <Link to="/dashboard" className="btn btn-primary">Go to Dashboard</Link>
              ) : (
                <>
                  <Link to="/register" className="btn btn-primary">Join for Free</Link>
                  <Link to="/search" className="btn btn-outline">Browse Skills</Link>
                </>
              )}
            </div>
          </div>
          <div className="hero-graphic">🤝</div>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Why SkillSwap?</h2>
        <p className="section-sub">Everything you need to trade and grow your skills</p>
        <div className="grid-3">
          <div className="feature-card">
            <div className="icon">🔁</div>
            <h3>Skill Exchanges</h3>
            <p>Offer a skill you know, request one you want — swap directly with matched users, no money needed.</p>
          </div>
          <div className="feature-card">
            <div className="icon">🎯</div>
            <h3>Smart Matching</h3>
            <p>Our matching engine finds people whose offered skills line up with what you want to learn.</p>
          </div>
          <div className="feature-card">
            <div className="icon">💳</div>
            <h3>Paid Learning</h3>
            <p>No swap partner available? Book a paid session with an expert, secured by Razorpay checkout.</p>
          </div>
          <div className="feature-card">
            <div className="icon">💬</div>
            <h3>Real-time Chat</h3>
            <p>Message your matches instantly to coordinate sessions before you commit.</p>
          </div>
          <div className="feature-card">
            <div className="icon">⭐</div>
            <h3>Ratings & Reviews</h3>
            <p>Build trust with verified ratings and reviews after every exchange or session.</p>
          </div>
          <div className="feature-card">
            <div className="icon">🔔</div>
            <h3>Live Notifications</h3>
            <p>Get notified instantly about matches, requests, bookings and payments.</p>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "var(--pista-lighter)" }}>
        <h2 className="section-title">How it works</h2>
        <div className="steps">
          <div className="step">
            <div className="step-num">1</div>
            <h4>Create your profile</h4>
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>List skills you offer and skills you want to learn.</p>
          </div>
          <div className="step">
            <div className="step-num">2</div>
            <h4>Get matched</h4>
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>We find people whose skills complement yours.</p>
          </div>
          <div className="step">
            <div className="step-num">3</div>
            <h4>Exchange or book</h4>
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Swap skills for free, or book a paid session.</p>
          </div>
          <div className="step">
            <div className="step-num">4</div>
            <h4>Learn & review</h4>
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Complete your session and rate your experience.</p>
          </div>
        </div>
      </section>

      <div className="cta">
        <h2>Ready to start swapping skills?</h2>
        <p>Join a community of learners and teachers today.</p>
        {!user && <Link to="/register" className="btn btn-primary">Create your free account</Link>}
      </div>
    </div>
  );
};

export default Landing;

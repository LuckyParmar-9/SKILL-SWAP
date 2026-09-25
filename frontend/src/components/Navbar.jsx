import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import api from "../api";

const Navbar = () => {
  const { user, logout } = useAuth();
  const socketCtx = useSocket();
  const navigate = useNavigate();
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const loadNotifications = async () => {
    try {
      const { data } = await api.get("/notifications");
      setNotifications(data);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (user) loadNotifications();
  }, [user]);

  useEffect(() => {
    if (socketCtx?.notifications?.length) {
      setNotifications((prev) => [socketCtx.notifications[0], ...prev]);
    }
  }, [socketCtx?.notifications]);

  const unread = notifications.filter((n) => !n.isRead).length;

  const openNotif = async () => {
    setShowNotif((s) => !s);
    if (!showNotif) {
      await api.put("/notifications/read-all").catch(() => {});
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand">🌱 SkillSwap</Link>
        <div className="nav-links">
          {user ? (
            <>
              <Link to="/dashboard">Dashboard</Link>
              <Link to="/search">Find Skills</Link>
              <Link to="/matches">Matches</Link>
              <Link to="/exchanges">Exchanges</Link>
              <Link to="/paid-providers">Paid Learning</Link>
              {user.role === "expert" && (
                <Link to="/my-paid-listings">
                  My Listings
                  {user.expertProfile?.verificationStatus === "pending" && <span className="badge">!</span>}
                </Link>
              )}
              {user.role === "expert" && <Link to="/provider/requests">Requests</Link>}
              <Link to="/messages">Messages</Link>
              <Link to="/profile">Profile</Link>
              {user.role === "admin" && <Link to="/admin">Admin</Link>}
              <button className="linklike" onClick={openNotif} style={{ position: "relative" }}>
                🔔{unread > 0 && <span className="badge">{unread}</span>}
              </button>
              {showNotif && (
                <div className="notif-panel">
                  {notifications.length === 0 ? (
                    <div className="notif-item">No notifications yet</div>
                  ) : (
                    notifications.map((n) => (
                      <div key={n._id} className={`notif-item ${n.isRead ? "" : "unread"}`}>
                        {n.message}
                      </div>
                    ))
                  )}
                </div>
              )}
              <button className="btn btn-outline btn-small" onClick={() => { logout(); navigate("/"); }}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register" className="btn btn-primary btn-small">Get Started</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

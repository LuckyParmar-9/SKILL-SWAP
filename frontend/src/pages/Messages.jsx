import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useCall } from "../context/CallContext";

const Messages = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();
  const { startCall, callState } = useCall();
  const [conversations, setConversations] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  // true/false once known; null = still checking. Defaults open-ish so a
  // free skill-swap conversation never sits there looking "locked" while
  // this loads — it only ever flips to false for an actual unpaid booking.
  const [gateOpen, setGateOpen] = useState(true);
  const [gateReason, setGateReason] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    api.get("/messages").then((res) => setConversations(res.data));
  }, []);

  useEffect(() => {
    if (!userId) return;
    api.get(`/messages/${userId}`).then((res) => setMessages(res.data));
    api.get(`/users/${userId}`).then((res) => setActiveUser(res.data.user));

    setGateReason("");
    api.get(`/messages/${userId}/access`).then((res) => setGateOpen(res.data.open));
  }, [userId]);

  useEffect(() => {
    if (!socket) return;
    const handler = (msg) => {
      if (msg.sender === userId || msg.receiver === userId) {
        setMessages((prev) => [...prev, msg]);
      }
    };
    // If the server rejected a send because payment hasn't cleared, this is
    // the safety net (the /access check above should normally catch it first).
    const handleBlocked = ({ receiverId, reason }) => {
      if (receiverId === userId) {
        setGateOpen(false);
        setGateReason(reason);
      }
    };
    socket.on("receiveMessage", handler);
    socket.on("messageSent", handler);
    socket.on("messageBlocked", handleBlocked);
    return () => {
      socket.off("receiveMessage", handler);
      socket.off("messageSent", handler);
      socket.off("messageBlocked", handleBlocked);
    };
  }, [socket, userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = (e) => {
    e.preventDefault();
    if (!text.trim() || !userId || !gateOpen) return;
    if (socket) {
      socket.emit("sendMessage", { receiverId: userId, content: text }); // US-29
    } else {
      api.post(`/messages/${userId}`, { content: text }).then((res) => setMessages((p) => [...p, res.data]));
    }
    setText("");
  };

  return (
    <div className="page">
      <h1 className="page-title">Messages</h1>
      <div className="chat-window">
        <div className="chat-sidebar">
          {conversations.length === 0 && <p className="empty-state" style={{ padding: 20 }}>No conversations yet.</p>}
          {conversations.map((c) => {
            const other = String(c.sender._id) === String(user._id) ? c.receiver : c.sender;
            return (
              <div key={c._id} className="chat-contact" onClick={() => navigate(`/messages/${other._id}`)} style={{ cursor: "pointer" }}>
                <div className="avatar">{other.name?.[0]}</div>
                <div>
                  <strong style={{ fontSize: 14 }}>{other.name}</strong>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>{c.content.slice(0, 30)}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="chat-main">
          {!userId ? (
            <div className="empty-state" style={{ margin: "auto" }}>Select a conversation to start chatting.</div>
          ) : (
            <>
              <div style={{ padding: 14, borderBottom: "1px solid var(--pista-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>{activeUser?.name || "..."}</strong>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn btn-outline btn-small"
                    disabled={callState !== "idle" || !gateOpen}
                    title={!gateOpen ? "Available once the first payment is completed" : undefined}
                    onClick={() => startCall(userId, activeUser?.name, "audio")}
                  >
                    🎤 Voice Call
                  </button>
                  <button
                    className="btn btn-outline btn-small"
                    disabled={callState !== "idle" || !gateOpen}
                    title={!gateOpen ? "Available once the first payment is completed" : undefined}
                    onClick={() => startCall(userId, activeUser?.name, "video")}
                  >
                    📹 Video Call
                  </button>
                </div>
              </div>

              {!gateOpen && (
                <div
                  style={{
                    background: "#fff3cd",
                    color: "#7a5b00",
                    padding: "10px 14px",
                    fontSize: 14,
                    borderBottom: "1px solid var(--pista-light)",
                  }}
                >
                  {gateReason ||
                    "Messaging and calling will open once the first payment for this booking is completed."}
                </div>
              )}

              <div className="chat-messages">
                {messages.map((m) => (
                  <div key={m._id} className={`msg-bubble ${String(m.sender) === String(user._id) || m.sender?._id === user._id ? "msg-mine" : "msg-theirs"}`}>
                    {m.content}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <form className="chat-input" onSubmit={send}>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={gateOpen ? "Type a message..." : "Locked until first payment is completed"}
                  disabled={!gateOpen}
                />
                <button className="btn btn-primary btn-small" disabled={!gateOpen}>Send</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messages;

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const locationRef = useRef(location);
  locationRef.current = location; // always read the latest pathname inside the socket handler below

  const socketRef = useRef(null);
  const [, forceRender] = useState(0); // re-render once socketRef.current is set, so consumers get a real socket
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [incomingMessage, setIncomingMessage] = useState(null); // global "new message" toast, any page

  useEffect(() => {
    // sessionStorage (not localStorage!) so two different users logged in across
    // two tabs of the SAME browser get independent sockets instead of colliding.
    const token = sessionStorage.getItem("skillswap_token");
    if (!user || !token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:5000", {
      auth: { token },
    });
    socketRef.current = socket;
    forceRender((n) => n + 1);

    socket.on("notification", (n) => {
      setNotifications((prev) => [n, ...prev]);
      setUnreadCount((c) => c + 1);
    });

    // Global "you got a message" toast (see components/MessageToast.jsx) — fires
    // no matter which page you're on, except when you're already looking at
    // that exact conversation (Messages.jsx handles that case itself).
    socket.on("receiveMessage", (msg) => {
      const senderId = String(msg.sender?._id || msg.sender);
      if (senderId === user._id) return; // echo of our own outgoing message
      if (locationRef.current.pathname === `/messages/${senderId}`) return; // already viewing this chat
      setIncomingMessage({ senderId, senderName: msg.senderName || "Someone", content: msg.content, ts: Date.now() });
    });

    return () => socket.disconnect();
  }, [user]);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        notifications,
        setNotifications,
        unreadCount,
        setUnreadCount,
        incomingMessage,
        dismissIncomingMessage: () => setIncomingMessage(null),
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);

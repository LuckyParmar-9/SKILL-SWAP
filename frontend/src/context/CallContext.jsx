import { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "./SocketContext";
import { useAuth } from "./AuthContext";
import api from "../api";

const CallContext = createContext(null);

const RING_TIMEOUT_MS = 30000;

// This context ONLY handles "ring the other person / did they accept" —
// the same job Socket.io was already doing. The actual audio/video connection
// (previously raw WebRTC with STUN/TURN/ICE) is now entirely Daily.co's job:
// the backend creates a temporary Daily room (POST /api/calls/create-room),
// and once both sides accept, CallModal.jsx embeds Daily's own call UI pointed
// at that room's URL. Daily's infrastructure handles NAT traversal invisibly.
export const CallProvider = ({ children }) => {
  const { socket } = useSocket();
  const { user } = useAuth();

  // idle | outgoing | incoming | active
  const [callState, setCallState] = useState("idle");
  const [callType, setCallType] = useState("audio"); // "audio" | "video"
  const [partner, setPartner] = useState(null); // { id, name }
  const [roomUrl, setRoomUrl] = useState(null);
  const [error, setError] = useState("");

  const ringTimeoutRef = useRef(null);

  const cleanup = useCallback(() => {
    clearTimeout(ringTimeoutRef.current);
    setPartner(null);
    setRoomUrl(null);
    setCallState("idle");
  }, []);

  // Caller: create a Daily room, then ring the other user with its URL
  const startCall = useCallback(
    async (toUserId, toName, type) => {
      if (callState !== "idle") return;
      setError("");
      try {
        const { data } = await api.post("/calls/create-room", { callType: type });
        setCallType(type);
        setPartner({ id: toUserId, name: toName });
        setRoomUrl(data.url);
        setCallState("outgoing");
        socket.emit("call:invite", { toUserId, callType: type, fromName: user.name, roomUrl: data.url });

        ringTimeoutRef.current = setTimeout(() => {
          socket.emit("call:cancel", { toUserId });
          setError("No answer");
          cleanup();
        }, RING_TIMEOUT_MS);
      } catch (err) {
        setError(err.response?.data?.message || "Could not start the call");
      }
    },
    [callState, socket, user, cleanup]
  );

  const cancelOutgoing = useCallback(() => {
    if (partner) socket.emit("call:cancel", { toUserId: partner.id });
    cleanup();
  }, [partner, socket, cleanup]);

  // Callee: accept — no media setup needed here, CallModal joins the Daily room directly
  const acceptCall = useCallback(() => {
    if (!partner) return;
    clearTimeout(ringTimeoutRef.current);
    socket.emit("call:accept", { toUserId: partner.id });
    setCallState("active");
  }, [partner, socket]);

  const rejectCall = useCallback(() => {
    if (partner) socket.emit("call:reject", { toUserId: partner.id });
    cleanup();
  }, [partner, socket, cleanup]);

  const endCall = useCallback(() => {
    if (partner) socket.emit("call:end", { toUserId: partner.id });
    cleanup();
  }, [partner, socket, cleanup]);

  useEffect(() => {
    if (!socket) return;

    const onIncoming = ({ fromUserId, fromName, callType: type, roomUrl: url }) => {
      if (callState !== "idle") {
        socket.emit("call:reject", { toUserId: fromUserId }); // busy
        return;
      }
      setError("");
      setPartner({ id: fromUserId, name: fromName });
      setCallType(type);
      setRoomUrl(url);
      setCallState("incoming");
      ringTimeoutRef.current = setTimeout(() => cleanup(), RING_TIMEOUT_MS);
    };

    const onCancelled = () => {
      if (callState === "incoming") cleanup();
    };

    // Caller side: callee accepted -> join the same Daily room now too
    const onAccepted = () => {
      clearTimeout(ringTimeoutRef.current);
      setCallState("active");
    };

    const onRejected = () => {
      setError("Call declined");
      cleanup();
    };

    const onEnded = () => cleanup();

    socket.on("call:incoming", onIncoming);
    socket.on("call:cancelled", onCancelled);
    socket.on("call:accepted", onAccepted);
    socket.on("call:rejected", onRejected);
    socket.on("call:ended", onEnded);

    return () => {
      socket.off("call:incoming", onIncoming);
      socket.off("call:cancelled", onCancelled);
      socket.off("call:accepted", onAccepted);
      socket.off("call:rejected", onRejected);
      socket.off("call:ended", onEnded);
    };
  }, [socket, callState, cleanup]);

  return (
    <CallContext.Provider
      value={{ callState, callType, partner, roomUrl, error, startCall, cancelOutgoing, acceptCall, rejectCall, endCall }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => useContext(CallContext);

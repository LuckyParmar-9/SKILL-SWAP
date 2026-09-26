import { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "./SocketContext";
import { useAuth } from "./AuthContext";
import api from "../api";

const CallContext = createContext(null);

const RING_TIMEOUT_MS = 30000;

// Ringing/accept/reject still travels over Socket.io, same as before. What's
// new: the Daily room is now PRIVATE, so joining it requires a personal
// meeting token, not just the room URL. Each side gets its own token from the
// backend (using its own login) — the caller gets theirs when the room is
// created, and the callee fetches theirs the moment they hit Accept. Neither
// side's token is ever sent through the socket signaling, so the ring/accept
// messages stay exactly as "harmless" as before — knowing the room exists
// still isn't enough to get into it.
export const CallProvider = ({ children }) => {
  const { socket } = useSocket();
  const { user } = useAuth();

  // idle | outgoing | incoming | active
  const [callState, setCallState] = useState("idle");
  const [callType, setCallType] = useState("audio"); // "audio" | "video"
  const [partner, setPartner] = useState(null); // { id, name }
  const [roomUrl, setRoomUrl] = useState(null);
  const [roomName, setRoomName] = useState(null);
  const [token, setToken] = useState(null); // this browser's own personal token
  const [error, setError] = useState("");

  const ringTimeoutRef = useRef(null);

  const cleanup = useCallback(() => {
    clearTimeout(ringTimeoutRef.current);
    setPartner(null);
    setRoomUrl(null);
    setRoomName(null);
    setToken(null);
    setCallState("idle");
  }, []);

  // Caller: create a private Daily room + get our own token, then ring the callee
  const startCall = useCallback(
    async (toUserId, toName, type) => {
      if (callState !== "idle") return;
      setError("");
      try {
        const { data } = await api.post("/calls/create-room", { callType: type });
        setCallType(type);
        setPartner({ id: toUserId, name: toName });
        setRoomUrl(data.url);
        setRoomName(data.name);
        setToken(data.token); // our own token — never sent to the callee
        setCallState("outgoing");

        // Only the room's URL/name go over the wire — no token
        socket.emit("call:invite", {
          toUserId,
          callType: type,
          fromName: user.name,
          roomUrl: data.url,
          roomName: data.name,
        });

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

  // Callee: fetch OUR OWN token for this room, then join directly once we have it
  const acceptCall = useCallback(async () => {
    if (!partner || !roomName) return;
    clearTimeout(ringTimeoutRef.current);
    try {
      const { data } = await api.post("/calls/token", { roomName });
      setToken(data.token);
      socket.emit("call:accept", { toUserId: partner.id });
      setCallState("active");
    } catch (err) {
      setError(err.response?.data?.message || "Could not join the call");
      socket.emit("call:reject", { toUserId: partner.id });
      cleanup();
    }
  }, [partner, roomName, socket, cleanup]);

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

    const onIncoming = ({ fromUserId, fromName, callType: type, roomUrl: url, roomName: name }) => {
      if (callState !== "idle") {
        socket.emit("call:reject", { toUserId: fromUserId }); // busy
        return;
      }
      setError("");
      setPartner({ id: fromUserId, name: fromName });
      setCallType(type);
      setRoomUrl(url);
      setRoomName(name);
      setCallState("incoming");
      ringTimeoutRef.current = setTimeout(() => cleanup(), RING_TIMEOUT_MS);
    };

    const onCancelled = () => {
      if (callState === "incoming") cleanup();
    };

    // Caller side: callee accepted -> we already have our own token from
    // create-room, so we can go straight to "active" and join directly.
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
      value={{
        callState,
        callType,
        partner,
        roomUrl,
        token,
        error,
        startCall,
        cancelOutgoing,
        acceptCall,
        rejectCall,
        endCall,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => useContext(CallContext);

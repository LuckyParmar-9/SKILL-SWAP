import { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "./SocketContext";
import { useAuth } from "./AuthContext";

const CallContext = createContext(null);

// Free public STUN server (Google) — helps two browsers behind home/office
// routers discover how to reach each other directly. Good enough for most
// networks. If some calls fail to connect (common on strict corporate/mobile
// networks), add a TURN server here too, e.g. a free tier from metered.ca,
// Twilio, or a self-hosted coturn instance:
//   { urls: "turn:your-turn-server.com:3478", username: "...", credential: "..." }
const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const RING_TIMEOUT_MS = 30000;

export const CallProvider = ({ children }) => {
  const { socket } = useSocket();
  const { user } = useAuth();

  // idle | outgoing | incoming | connecting | active
  const [callState, setCallState] = useState("idle");
  const [callType, setCallType] = useState("audio"); // "audio" | "video"
  const [partner, setPartner] = useState(null); // { id, name }
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [error, setError] = useState("");

  const pcRef = useRef(null);
  const ringTimeoutRef = useRef(null);
  const pendingCandidatesRef = useRef([]); // ICE candidates arriving before remoteDescription is set

  const cleanup = useCallback(() => {
    clearTimeout(ringTimeoutRef.current);
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setLocalStream((prev) => {
      prev?.getTracks().forEach((t) => t.stop());
      return null;
    });
    setRemoteStream(null);
    setPartner(null);
    setCallState("idle");
    pendingCandidatesRef.current = [];
  }, []);

  const createPeerConnection = useCallback(
    (partnerId) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit("call:ice-candidate", { toUserId: partnerId, candidate: e.candidate });
      };
      pc.ontrack = (e) => setRemoteStream(e.streams[0]);
      pcRef.current = pc;
      return pc;
    },
    [socket]
  );

  const getMedia = async (type) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === "video" });
    setLocalStream(stream);
    return stream;
  };

  // Caller: start a call
  const startCall = useCallback(
    (toUserId, toName, type) => {
      if (callState !== "idle") return;
      setError("");
      setCallType(type);
      setPartner({ id: toUserId, name: toName });
      setCallState("outgoing");
      socket.emit("call:invite", { toUserId, callType: type, fromName: user.name });

      ringTimeoutRef.current = setTimeout(() => {
        socket.emit("call:cancel", { toUserId });
        setError("No answer");
        cleanup();
      }, RING_TIMEOUT_MS);
    },
    [callState, socket, user, cleanup]
  );

  const cancelOutgoing = useCallback(() => {
    if (partner) socket.emit("call:cancel", { toUserId: partner.id });
    cleanup();
  }, [partner, socket, cleanup]);

  // Callee: accept
  const acceptCall = useCallback(async () => {
    if (!partner) return;
    clearTimeout(ringTimeoutRef.current);
    try {
      setCallState("connecting");
      await getMedia(callType);
      socket.emit("call:accept", { toUserId: partner.id });
    } catch {
      setError("Camera/microphone permission denied or unavailable");
      socket.emit("call:reject", { toUserId: partner.id });
      cleanup();
    }
  }, [partner, callType, socket, cleanup]);

  const rejectCall = useCallback(() => {
    if (partner) socket.emit("call:reject", { toUserId: partner.id });
    cleanup();
  }, [partner, socket, cleanup]);

  const endCall = useCallback(() => {
    if (partner) socket.emit("call:end", { toUserId: partner.id });
    cleanup();
  }, [partner, socket, cleanup]);

  const toggleMute = useCallback(() => {
    localStream?.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
  }, [localStream]);

  const toggleVideo = useCallback(() => {
    localStream?.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
  }, [localStream]);

  useEffect(() => {
    if (!socket) return;

    const onIncoming = ({ fromUserId, fromName, callType: type }) => {
      if (callState !== "idle") {
        socket.emit("call:reject", { toUserId: fromUserId }); // busy
        return;
      }
      setError("");
      setPartner({ id: fromUserId, name: fromName });
      setCallType(type);
      setCallState("incoming");
      ringTimeoutRef.current = setTimeout(() => cleanup(), RING_TIMEOUT_MS);
    };

    const onCancelled = () => {
      if (callState === "incoming") cleanup();
    };

    const onAccepted = async ({ fromUserId }) => {
      clearTimeout(ringTimeoutRef.current);
      try {
        setCallState("connecting");
        const stream = await getMedia(callType);
        const pc = createPeerConnection(fromUserId);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("call:offer", { toUserId: fromUserId, sdp: offer });
      } catch {
        setError("Camera/microphone permission denied or unavailable");
        socket.emit("call:end", { toUserId: fromUserId });
        cleanup();
      }
    };

    const onRejected = () => {
      setError("Call declined");
      cleanup();
    };

    const onOffer = async ({ fromUserId, sdp }) => {
      const pc = createPeerConnection(fromUserId);
      if (localStream) localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      for (const c of pendingCandidatesRef.current) await pc.addIceCandidate(c);
      pendingCandidatesRef.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("call:answer", { toUserId: fromUserId, sdp: answer });
      setCallState("active");
    };

    const onAnswer = async ({ sdp }) => {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      for (const c of pendingCandidatesRef.current) await pc.addIceCandidate(c);
      pendingCandidatesRef.current = [];
      setCallState("active");
    };

    const onIceCandidate = async ({ candidate }) => {
      const pc = pcRef.current;
      if (pc && pc.remoteDescription) await pc.addIceCandidate(candidate);
      else pendingCandidatesRef.current.push(candidate);
    };

    const onEnded = () => cleanup();

    socket.on("call:incoming", onIncoming);
    socket.on("call:cancelled", onCancelled);
    socket.on("call:accepted", onAccepted);
    socket.on("call:rejected", onRejected);
    socket.on("call:offer", onOffer);
    socket.on("call:answer", onAnswer);
    socket.on("call:ice-candidate", onIceCandidate);
    socket.on("call:ended", onEnded);

    return () => {
      socket.off("call:incoming", onIncoming);
      socket.off("call:cancelled", onCancelled);
      socket.off("call:accepted", onAccepted);
      socket.off("call:rejected", onRejected);
      socket.off("call:offer", onOffer);
      socket.off("call:answer", onAnswer);
      socket.off("call:ice-candidate", onIceCandidate);
      socket.off("call:ended", onEnded);
    };
  }, [socket, callState, callType, localStream, createPeerConnection, cleanup]);

  return (
    <CallContext.Provider
      value={{
        callState,
        callType,
        partner,
        localStream,
        remoteStream,
        error,
        startCall,
        cancelOutgoing,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleVideo,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => useContext(CallContext);

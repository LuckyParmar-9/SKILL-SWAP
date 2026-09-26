import { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "./SocketContext";
import { useAuth } from "./AuthContext";

const CallContext = createContext(null);

const RING_TIMEOUT_MS = 30000;

// Free STUN + TURN so calls connect even across different networks/firewalls,
// not just two people on the same Wi-Fi. STUN (Google's) helps two browsers
// discover each other's public address; TURN (OpenRelay by Metered) is the
// fallback that relays media when a direct connection can't be made at all.
// The OpenRelay credentials below are public and shared by everyone using
// them, with a monthly bandwidth cap — fine for a college project, but if
// you ever hit that cap, sign up free at https://dashboard.metered.ca/signup
// for your own private TURN credentials (also free, higher cap) and swap
// them in here.
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
];

export const CallProvider = ({ children }) => {
  const { socket } = useSocket();
  const { user } = useAuth();

  // idle | outgoing | incoming | active
  const [callState, setCallState] = useState("idle");
  const [callType, setCallType] = useState("audio"); // "audio" | "video"
  const [partner, setPartner] = useState(null); // { id, name }
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [error, setError] = useState("");

  const ringTimeoutRef = useRef(null);
  const pcRef = useRef(null); // the RTCPeerConnection for the current call
  const isCallerRef = useRef(false); // who's the offerer vs the answerer
  const pendingCandidatesRef = useRef([]); // ICE candidates that arrive before remoteDescription is set

  const stopLocalTracks = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.getSenders().forEach((s) => s.track && s.track.stop());
    }
  }, []);

  const cleanup = useCallback(() => {
    clearTimeout(ringTimeoutRef.current);
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    stopLocalTracks();
    pendingCandidatesRef.current = [];
    isCallerRef.current = false;
    setLocalStream((prev) => {
      prev?.getTracks().forEach((t) => t.stop());
      return null;
    });
    setRemoteStream(null);
    setPartner(null);
    setCallState("idle");
  }, [stopLocalTracks]);

  // Builds the RTCPeerConnection and wires up ICE/track/state handlers.
  // Called by BOTH sides once a call is accepted — the caller then creates
  // an offer, the callee waits for one.
  const setupPeerConnection = useCallback(
    (toUserId, mediaType) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("webrtc:ice-candidate", { toUserId, candidate: event.candidate });
        }
      };

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };

      pc.onconnectionstatechange = () => {
        if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
          setError((prev) => prev || "Call connection lost");
        }
      };

      return navigator.mediaDevices
        .getUserMedia({ audio: true, video: mediaType === "video" })
        .then((stream) => {
          setLocalStream(stream);
          stream.getTracks().forEach((track) => pc.addTrack(track, stream));
          return pc;
        });
    },
    [socket]
  );

  // Caller: ring the callee (no media/peer connection yet — that only
  // starts once they accept, so we don't ask for camera/mic permission
  // during ringing).
  const startCall = useCallback(
    (toUserId, toName, type) => {
      if (callState !== "idle") return;
      setError("");
      isCallerRef.current = true;
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

  // Callee: accept, grab media, create the peer connection, then WAIT for
  // the caller's offer (which arrives via the "webrtc:offer" socket event below).
  const acceptCall = useCallback(async () => {
    if (!partner) return;
    clearTimeout(ringTimeoutRef.current);
    try {
      await setupPeerConnection(partner.id, callType);
      socket.emit("call:accept", { toUserId: partner.id });
      setCallState("active");
    } catch (err) {
      setError("Could not access camera/microphone");
      socket.emit("call:reject", { toUserId: partner.id });
      cleanup();
    }
  }, [partner, callType, setupPeerConnection, socket, cleanup]);

  const rejectCall = useCallback(() => {
    if (partner) socket.emit("call:reject", { toUserId: partner.id });
    cleanup();
  }, [partner, socket, cleanup]);

  const endCall = useCallback(() => {
    if (partner) socket.emit("call:end", { toUserId: partner.id });
    cleanup();
  }, [partner, socket, cleanup]);

  const clearError = useCallback(() => setError(""), []);

  const toggleMute = useCallback(() => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
  }, [localStream]);

  const toggleCamera = useCallback(() => {
    if (!localStream) return;
    localStream.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
  }, [localStream]);

  useEffect(() => {
    if (!socket) return;

    const onIncoming = ({ fromUserId, fromName, callType: type }) => {
      if (callState !== "idle") {
        socket.emit("call:reject", { toUserId: fromUserId }); // busy
        return;
      }
      setError("");
      isCallerRef.current = false;
      setPartner({ id: fromUserId, name: fromName });
      setCallType(type);
      setCallState("incoming");
      ringTimeoutRef.current = setTimeout(() => cleanup(), RING_TIMEOUT_MS);
    };

    const onCancelled = () => {
      if (callState === "incoming") cleanup();
    };

    // Caller side: callee accepted -> set up OUR peer connection + media,
    // then create and send the offer.
    const onAccepted = async ({ fromUserId }) => {
      clearTimeout(ringTimeoutRef.current);
      try {
        const pc = await setupPeerConnection(fromUserId, callType);
        setCallState("active");
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("webrtc:offer", { toUserId: fromUserId, sdp: pc.localDescription });
      } catch (err) {
        setError("Could not access camera/microphone");
        endCall();
      }
    };

    const onRejected = () => {
      setError("Call declined");
      cleanup();
    };

    const onEnded = () => cleanup();

    // Server refused to even ring the callee (payment gate closed). If we're
    // the one who tried to call, show why and stop "ringing" — otherwise this
    // would just hang on the "Calling..." screen forever.
    const onBlocked = ({ reason }) => {
      setError(reason || "This call isn't available right now");
      cleanup();
    };

    // Callee receives the caller's offer -> answer it
    const onOffer = async ({ sdp }) => {
      const pc = pcRef.current;
      if (!pc || isCallerRef.current) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      for (const candidate of pendingCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      if (partner) socket.emit("webrtc:answer", { toUserId: partner.id, sdp: pc.localDescription });
    };

    // Caller receives the callee's answer
    const onAnswer = async ({ sdp }) => {
      const pc = pcRef.current;
      if (!pc || !isCallerRef.current) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      for (const candidate of pendingCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current = [];
    };

    const onIceCandidate = async ({ candidate }) => {
      const pc = pcRef.current;
      if (!pc) return;
      if (!pc.remoteDescription || !pc.remoteDescription.type) {
        pendingCandidatesRef.current.push(candidate);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Harmless if a stray candidate arrives after the connection settled
      }
    };

    socket.on("call:incoming", onIncoming);
    socket.on("call:cancelled", onCancelled);
    socket.on("call:accepted", onAccepted);
    socket.on("call:rejected", onRejected);
    socket.on("call:ended", onEnded);
    socket.on("call:blocked", onBlocked);
    socket.on("webrtc:offer", onOffer);
    socket.on("webrtc:answer", onAnswer);
    socket.on("webrtc:ice-candidate", onIceCandidate);

    return () => {
      socket.off("call:incoming", onIncoming);
      socket.off("call:cancelled", onCancelled);
      socket.off("call:accepted", onAccepted);
      socket.off("call:rejected", onRejected);
      socket.off("call:ended", onEnded);
      socket.off("call:blocked", onBlocked);
      socket.off("webrtc:offer", onOffer);
      socket.off("webrtc:answer", onAnswer);
      socket.off("webrtc:ice-candidate", onIceCandidate);
    };
  }, [socket, callState, callType, partner, setupPeerConnection, cleanup, endCall]);

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
        toggleCamera,
        clearError,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => useContext(CallContext);

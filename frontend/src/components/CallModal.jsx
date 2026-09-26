import { useEffect, useRef, useState } from "react";
import { useCall } from "../context/CallContext";

const CallModal = () => {
  const {
    callState,
    callType,
    partner,
    localStream,
    remoteStream,
    error,
    acceptCall,
    rejectCall,
    cancelOutgoing,
    endCall,
    toggleMute,
    toggleCamera,
  } = useCall();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream || null;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream || null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream || null;
  }, [remoteStream]);

  if (!callState || callState === "idle") return null;

  const handleMute = () => {
    toggleMute();
    setMuted((m) => !m);
  };

  const handleCamera = () => {
    toggleCamera();
    setCameraOff((c) => !c);
  };

  return (
    <div className="call-overlay">
      <div className="call-box" style={callState === "active" ? { width: "min(900px, 90vw)" } : {}}>
        {callState === "incoming" && (
          <>
            <div className="call-avatar">{partner?.name?.[0]}</div>
            <h3>{partner?.name}</h3>
            <p>Incoming {callType === "video" ? "video" : "voice"} call...</p>
            <div className="call-actions">
              <button className="btn btn-primary" onClick={acceptCall}>Accept</button>
              <button className="btn btn-danger" onClick={rejectCall}>Decline</button>
            </div>
          </>
        )}

        {callState === "outgoing" && (
          <>
            <div className="call-avatar">{partner?.name?.[0]}</div>
            <h3>{partner?.name}</h3>
            <p>Calling... ({callType === "video" ? "video" : "voice"})</p>
            <div className="call-actions">
              <button className="btn btn-danger" onClick={cancelOutgoing}>Cancel</button>
            </div>
          </>
        )}

        {callState === "active" && (
          <>
            <h3>{callType === "video" ? "Video" : "Voice"} call with {partner?.name}</h3>

            {callType === "video" ? (
              <div style={{ position: "relative", width: "100%", height: 480, marginTop: 14, background: "#1e293b", borderRadius: 12, overflow: "hidden" }}>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    position: "absolute",
                    bottom: 12,
                    right: 12,
                    width: 140,
                    height: 100,
                    objectFit: "cover",
                    borderRadius: 8,
                    border: "2px solid white",
                  }}
                />
              </div>
            ) : (
              <>
                <div className="call-avatar" style={{ marginTop: 14 }}>{partner?.name?.[0]}</div>
                <audio ref={remoteAudioRef} autoPlay />
              </>
            )}

            <div className="call-actions" style={{ marginTop: 14 }}>
              <button className="btn" onClick={handleMute}>{muted ? "Unmute" : "Mute"}</button>
              {callType === "video" && (
                <button className="btn" onClick={handleCamera}>{cameraOff ? "Camera On" : "Camera Off"}</button>
              )}
              <button className="btn btn-danger" onClick={endCall}>End Call</button>
            </div>
          </>
        )}

        {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}
      </div>
    </div>
  );
};

export default CallModal;

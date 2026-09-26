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
    clearError,
  } = useCall();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const overlayRef = useRef(null); // the element we put into native fullscreen
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream || null;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream || null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream || null;
  }, [remoteStream]);

  // Keep our button label in sync if the user exits fullscreen with Esc
  // (rather than our own button) — the browser fires this either way.
  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // Automatically leave native fullscreen once the call ends, so the person
  // isn't stuck in a fullscreen empty page.
  useEffect(() => {
    if (callState !== "active" && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, [callState]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      // Rare failure case (e.g. running inside a restricted iframe) — just
      // stays in the normal windowed view if the browser refuses.
      overlayRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  if (!callState || callState === "idle") {
    // A blocked/failed call sets an error and returns to idle in the same
    // tick — without this, the error would be set but never seen because
    // the modal unmounts immediately. Show it briefly with a dismiss button.
    if (error) {
      return (
        <div className="call-overlay">
          <div className="call-box">
            <p className="form-error">{error}</p>
            <button className="btn" style={{ marginTop: 10 }} onClick={clearError}>OK</button>
          </div>
        </div>
      );
    }
    return null;
  }

  const handleMute = () => {
    toggleMute();
    setMuted((m) => !m);
  };

  const handleCamera = () => {
    toggleCamera();
    setCameraOff((c) => !c);
  };

  return (
    <div className="call-overlay" ref={overlayRef}>
      <div
        className="call-box"
        style={
          callState === "active"
            ? isFullscreen
              ? { width: "100vw", height: "100vh", maxWidth: "none", borderRadius: 0 }
              : { width: "min(1100px, 95vw)" }
            : {}
        }
      >
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
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: isFullscreen ? "calc(100vh - 140px)" : 480,
                  marginTop: 14,
                  background: "#1e293b",
                  borderRadius: isFullscreen ? 0 : 12,
                  overflow: "hidden",
                }}
              >
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
              <button className="btn" onClick={toggleFullscreen}>
                {isFullscreen ? "Exit Full Screen" : "Full Screen"}
              </button>
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

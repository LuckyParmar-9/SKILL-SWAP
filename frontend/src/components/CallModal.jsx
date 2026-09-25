import { useEffect, useRef } from "react";
import { useCall } from "../context/CallContext";

const CallModal = () => {
  const {
    callState, callType, partner, localStream, remoteStream, error,
    acceptCall, rejectCall, cancelOutgoing, endCall, toggleMute, toggleVideo,
  } = useCall();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream || null;
  }, [localStream]);

  useEffect(() => {
    if (callType === "video" && remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream || null;
    if (callType === "audio" && remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream || null;
  }, [remoteStream, callType]);

  if (!callState || callState === "idle") return null;

  return (
    <div className="call-overlay">
      <div className="call-box">
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

        {(callState === "connecting" || callState === "active") && (
          <>
            <h3>{callType === "video" ? "Video" : "Voice"} call with {partner?.name}</h3>
            {callState === "connecting" && <p>Connecting...</p>}

            {callType === "video" ? (
              <div className="call-video-grid">
                <video ref={remoteVideoRef} autoPlay playsInline className="call-video remote" />
                <video ref={localVideoRef} autoPlay playsInline muted className="call-video local" />
              </div>
            ) : (
              <div className="call-avatar" style={{ width: 90, height: 90, fontSize: 34 }}>{partner?.name?.[0]}</div>
            )}
            <audio ref={remoteAudioRef} autoPlay />

            <div className="call-actions">
              <button className="btn btn-outline" onClick={toggleMute}>🎙 Mute/Unmute</button>
              {callType === "video" && <button className="btn btn-outline" onClick={toggleVideo}>📷 Camera On/Off</button>}
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

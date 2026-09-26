import { useEffect, useRef } from "react";
import DailyIframe from "@daily-co/daily-js";
import { useCall } from "../context/CallContext";

const CallModal = () => {
  const { callState, callType, partner, roomUrl, error, acceptCall, rejectCall, cancelOutgoing, endCall } = useCall();
  const containerRef = useRef(null);
  const callFrameRef = useRef(null);

  // Once both sides have accepted (callState === "active"), embed Daily's own
  // call screen pointed at the room the backend created. Daily's UI already
  // includes mute/camera/leave controls, so we don't build our own.
  useEffect(() => {
    if (callState !== "active" || !roomUrl || !containerRef.current) return;

    const callFrame = DailyIframe.createFrame(containerRef.current, {
      url: roomUrl,
      showLeaveButton: true,
      iframeStyle: { width: "100%", height: "100%", border: "0", borderRadius: "12px" },
    });
    callFrameRef.current = callFrame;
    callFrame.join({ startVideoOff: callType === "audio" });

    // Fires when the local user clicks Daily's own "Leave" button
    callFrame.on("left-meeting", () => endCall());

    return () => {
      callFrame.destroy();
      callFrameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callState, roomUrl]);

  if (!callState || callState === "idle") return null;

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
            <div ref={containerRef} style={{ width: "100%", height: 480, marginTop: 14 }} />
          </>
        )}

        {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}
      </div>
    </div>
  );
};

export default CallModal;

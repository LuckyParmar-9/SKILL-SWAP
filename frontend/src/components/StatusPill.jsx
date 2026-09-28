// A shared status badge. Uses inline styles (which always win over the
// external stylesheet) to force a proper rounded-rectangle "pill" shape sized
// to its text, rather than whatever fixed circle shape .status-pill applies
// elsewhere in the app's CSS — that's what was causing the label to float
// above/outside the badge instead of sitting inside it.
const StatusPill = ({ status, children }) => (
  <span
    className={`status-pill status-${status}`}
    style={{
      display: "inline-block",
      padding: "4px 14px",
      borderRadius: 999,
      width: "auto",
      height: "auto",
      whiteSpace: "nowrap",
      lineHeight: 1.4,
      textAlign: "center",
    }}
  >
    {children ?? status}
  </span>
);

export default StatusPill;

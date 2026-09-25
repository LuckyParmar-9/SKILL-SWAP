const Stars = ({ rating = 0, count }) => {
  const full = Math.round(rating);
  return (
    <span className="stars">
      {"★".repeat(full)}
      {"☆".repeat(5 - full)}
      {typeof count === "number" && (
        <span style={{ color: "var(--text-muted)", fontSize: 13, marginLeft: 4 }}>
          ({count})
        </span>
      )}
    </span>
  );
};

export default Stars;

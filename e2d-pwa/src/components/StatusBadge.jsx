function StatusBadge({ status }) {
  const value = status || "pending";

  return <span className={`status-badge status-${value}`}>{value.replaceAll("_", " ")}</span>;
}

export default StatusBadge;
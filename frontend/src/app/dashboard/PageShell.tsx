export default function PageShell({
    title,
    text,
  }: {
    title: string;
    text: string;
  }) {
    return (
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 20,
          padding: 24,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28 }}>{title}</h1>
        <p style={{ marginTop: 10, color: "#64748b", fontSize: 15 }}>{text}</p>
      </div>
    );
  }
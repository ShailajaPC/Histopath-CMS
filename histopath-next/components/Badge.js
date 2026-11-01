const colors = {
  Malignant:    { bg:'#fde8e8', color:'#c62828' },
  Benign:       { bg:'#e8f5e9', color:'#2e7d32' },
  Inflammatory: { bg:'#fff3e0', color:'#e65100' },
  Reactive:     { bg:'#e3f2fd', color:'#1565c0' },
  Other:        { bg:'#f3e5f5', color:'#6a1b9a' },
  URGENT:       { bg:'#fde8e8', color:'#c62828' },
  ROUTINE:      { bg:'#e8f5e9', color:'#2e7d32' },
  SIGNED:       { bg:'#e8f5e9', color:'#2e7d32' },
  PATHOLOGIST:  { bg:'#e3f2fd', color:'#1565c0' },
  ADMIN:        { bg:'#fde8e8', color:'#c62828' },
  TECHNICIAN:   { bg:'#f3e5f5', color:'#6a1b9a' },
};

export default function Badge({ label }) {
  const s = colors[label] || { bg:'#f0f0f0', color:'#333' };
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: '3px 10px', borderRadius: '20px',
      fontSize: '.72rem', fontWeight: 600,
    }}>{label}</span>
  );
}

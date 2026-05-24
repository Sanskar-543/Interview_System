export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        top: '-20%',
        left: '30%',
        width: '60vw',
        height: '60vw',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(37, 99, 235, 0.12) 0%, rgba(3, 7, 18, 0) 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-15%',
        right: '20%',
        width: '50vw',
        height: '50vw',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, rgba(3, 7, 18, 0) 75%)',
        pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: '440px', padding: '1.5rem' }}>
        {children}
      </div>
    </div>
  );
}

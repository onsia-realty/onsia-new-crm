'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontFamily: 'system-ui, sans-serif'
        }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>
            시스템 오류가 발생했습니다
          </h2>
          <p style={{ color: '#666', marginBottom: '24px' }}>
            죄송합니다. 예기치 않은 오류가 발생했습니다.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: '8px 16px',
              backgroundColor: '#000',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  )
}
import { useEffect, useState } from 'react'

export default function AlertsLayer() {
  const [toasts, setToasts] = useState<any[]>([])

  useEffect(() => {
    // Check and request HTML5 Notification permission
    if ("Notification" in window) {
      if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission()
      }
    }

    const eventSource = new EventSource('http://localhost:8000/api/stream')

    eventSource.addEventListener('alert', (e) => {
      try {
        const alerts = JSON.parse(e.data)

        alerts.forEach((alert: any) => {
          // Show in-app toast
          const id = Date.now() + Math.random()
          setToasts(prev => [...prev, { id, ...alert }])

          // Remove toast after 5s
          setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
          }, 5000)

          // Show browser notification if permitted
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Aurora Alert!", {
              body: alert.message,
              icon: '/favicon.svg' // Provide a valid icon path in real deployment
            })
          }
        })
      } catch (err) {
        console.error("Error parsing alert event:", err)
      }
    })

    return () => {
      eventSource.close()
    }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded shadow-lg border-l-4 text-white max-w-sm flex items-center
            ${toast.type === 'severe_bz' ? 'bg-red-900 border-red-500' : 'bg-orange-900 border-orange-500'}
          `}
        >
          <div className="flex-1">
            <h4 className="font-bold">{toast.type === 'severe_bz' ? 'Bz Dropped Significantly' : 'Substorm Precursor Detected'}</h4>
            <p className="text-sm">{toast.message}</p>
          </div>
          <button
            onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
            className="ml-4 text-gray-300 hover:text-white"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

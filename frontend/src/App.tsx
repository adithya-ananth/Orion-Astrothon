import { useState, useEffect } from 'react'
import AuroraMap from './components/AuroraMap'
import Dashboard from './components/Dashboard'
import AlertsLayer from './components/AlertsLayer'
import SubscribeModal from './components/SubscribeModal'
import { Bell } from 'lucide-react'

function App() {
  const [showMap, setShowMap] = useState(false)
  const [isSubscribeOpen, setIsSubscribeOpen] = useState(false)
  const [location, setLocation] = useState({ lat: 60.0, lon: -100.0, name: 'Default Location' })

  // Load saved location on mount
  useEffect(() => {
    const saved = localStorage.getItem('aurora_location')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed && typeof parsed.lat === 'number') {
            setLocation(parsed)
        }
      } catch (e) {
        console.error("Failed to parse saved location")
      }
    }
  }, [])

  // Lazy load map to avoid window undefined errors in SSR if we used Next,
  // but in Vite it just helps with initial load performance
  useEffect(() => {
    const timer = setTimeout(() => setShowMap(true), 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col font-sans relative">
      <AlertsLayer />
      <SubscribeModal isOpen={isSubscribeOpen} onClose={() => setIsSubscribeOpen(false)} />

      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 w-10 h-10 rounded-lg flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-xl">O</span>
            </div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
              Orion Astrathon
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsSubscribeOpen(true)}
              className="text-gray-400 hover:text-white transition flex items-center space-x-1 border border-gray-600 px-3 py-1.5 rounded-full hover:bg-gray-700"
            >
              <Bell className="w-4 h-4" />
              <span className="text-sm font-medium">Subscribe Alerts</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 space-y-6">

        {/* Intro */}
        <section className="mb-8 mt-4">
          <h2 className="text-3xl font-bold mb-3">Hyper-Local Aurora Forecasting</h2>
          <p className="text-gray-400 max-w-3xl leading-relaxed">
            Real-time space weather intelligence combining NOAA OVATION probability, localized cloud cover, and precise darkness calculations to tell you exactly when and where to shoot.
          </p>
        </section>

        {/* Map */}
        <section className="relative z-10 bg-gray-800 p-4 rounded-xl border border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold flex items-center">
              <span className="w-3 h-3 rounded-full bg-green-500 mr-3 animate-pulse"></span>
              Live OVATION Probability Grid
            </h3>
            <span className="text-xs bg-gray-900 px-2 py-1 rounded text-gray-400">Updates every 30 mins</span>
          </div>
          {showMap ? <AuroraMap userLocation={location} /> : <div className="h-[500px] bg-gray-900 rounded-xl animate-pulse"></div>}
        </section>

        {/* Dashboard */}
        <section>
          <Dashboard location={location} setLocation={setLocation} />
        </section>

      </main>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700 py-8 mt-12 text-center text-gray-500 text-sm">
        <p className="mb-2">Built for Orion Astrathon • Space Weather & Aurora Forecasting</p>
        <p className="text-xs">Data provided by NOAA SWPC and Open-Meteo.</p>
      </footer>
    </div>
  )
}

export default App

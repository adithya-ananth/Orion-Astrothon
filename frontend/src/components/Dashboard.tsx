import { useState, useEffect } from 'react'
import axios from 'axios'
import { MapPin, Cloud, Moon, Zap, AlertTriangle, Navigation } from 'lucide-react'

interface DashboardProps {
  location: { lat: number; lon: number; name: string };
  setLocation: React.Dispatch<React.SetStateAction<{ lat: number; lon: number; name: string }>>;
}

export default function Dashboard({ location, setLocation }: DashboardProps) {
  const [solarWind, setSolarWind] = useState<any>(null)
  const [visibility, setVisibility] = useState<any>(null)
  const [inputLat, setInputLat] = useState('60.0')
  const [inputLon, setInputLon] = useState('-100.0')
  const [isLocating, setIsLocating] = useState(false)
  const [locationError, setLocationError] = useState('')

  // Sync inputs when location prop changes
  useEffect(() => {
    setInputLat(location.lat.toString())
    setInputLon(location.lon.toString())
  }, [location])

  useEffect(() => {
    // Fetch solar wind initially and every minute
    const fetchSolarWind = () => {
      axios.get('http://localhost:8000/api/solar-wind')
        .then(res => setSolarWind(res.data))
        .catch(err => console.error(err))
    }

    fetchSolarWind()
    const swInterval = setInterval(fetchSolarWind, 60000)

    return () => clearInterval(swInterval)
  }, [])

  useEffect(() => {
    // Fetch visibility score when location changes or every 30 mins
    const fetchVisibility = () => {
      axios.post('http://localhost:8000/api/visibility', { lat: location.lat, lon: location.lon })
        .then(res => {
          if (!res.data.error) {
            setVisibility(res.data)
          }
        })
        .catch(err => console.error(err))
    }

    fetchVisibility()
    const visInterval = setInterval(fetchVisibility, 1800000)

    return () => clearInterval(visInterval)
  }, [location])

  const saveLocation = () => {
    const newLoc = { lat: parseFloat(inputLat), lon: parseFloat(inputLon), name: 'Custom Location' }
    setLocation(newLoc)
    localStorage.setItem('aurora_location', JSON.stringify(newLoc))
  }

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.')
      return
    }

    setIsLocating(true)
    setLocationError('')

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false)
        const lat = position.coords.latitude
        const lon = position.coords.longitude
        setInputLat(lat.toFixed(4))
        setInputLon(lon.toFixed(4))

        const newLoc = { lat, lon, name: 'My Location' }
        setLocation(newLoc)
        localStorage.setItem('aurora_location', JSON.stringify(newLoc))
      },
      (error) => {
        setIsLocating(false)
        setLocationError('Unable to retrieve your location. Check browser permissions.')
        console.error('Error getting location:', error)
      }
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
      {/* Location Settings */}
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
        <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
          <div className="flex items-center">
            <MapPin className="mr-2 text-blue-400" /> Location Settings
          </div>
        </h2>

        <div className="space-y-4">
          <button
            onClick={handleUseMyLocation}
            disabled={isLocating}
            className="w-full flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold py-2 px-4 rounded transition disabled:opacity-50"
          >
            <Navigation className="w-4 h-4 mr-2" />
            {isLocating ? 'Locating...' : 'Use My Location'}
          </button>

          {locationError && (
            <p className="text-red-400 text-sm text-center">{locationError}</p>
          )}

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-600"></div>
            <span className="flex-shrink-0 mx-4 text-gray-500 text-sm font-semibold">OR MANUAL ENTRY</span>
            <div className="flex-grow border-t border-gray-600"></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Latitude</label>
              <input
                type="number"
                value={inputLat}
                onChange={e => setInputLat(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Longitude</label>
              <input
                type="number"
                value={inputLon}
                onChange={e => setInputLon(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
              />
            </div>
          </div>

          <button
            onClick={saveLocation}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition mt-2"
          >
            Save & Calc Score
          </button>
        </div>
      </div>

      {/* Real-time Solar Wind */}
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
        <h2 className="text-xl font-bold mb-4 flex items-center"><Zap className="mr-2 text-yellow-400" /> Space Weather</h2>
        {solarWind ? (
          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-400 mb-1">IMF Bz (Southward orientation is good)</p>
              <div className={`text-4xl font-bold ${solarWind.bz < -7 ? 'text-green-500' : solarWind.bz < 0 ? 'text-green-400' : 'text-red-400'}`}>
                {solarWind.bz} nT
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Solar Wind Speed</p>
              <div className="text-2xl font-bold text-gray-200">
                {solarWind.speed} km/s
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">dBz/dt Rate (Substorm proxy)</p>
              <div className={`text-2xl font-bold ${Math.abs(solarWind.bz_rate) > 2 ? 'text-orange-400' : 'text-gray-200'}`}>
                {solarWind.bz_rate?.toFixed(2) || 0} nT/min
              </div>
            </div>
          </div>
        ) : (
          <p className="text-gray-400 animate-pulse">Loading data...</p>
        )}
      </div>

      {/* Visibility Score */}
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
        <h2 className="text-xl font-bold mb-4 flex items-center"><AlertTriangle className="mr-2 text-purple-400" /> Visibility Score</h2>
        {visibility ? (
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-700" />
                <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="8" fill="transparent"
                  strokeDasharray={`${2 * Math.PI * 60}`}
                  strokeDashoffset={`${2 * Math.PI * 60 * (1 - visibility.score / 100)}`}
                  className={`${visibility.score > 50 ? 'text-green-500' : 'text-red-500'} transition-all duration-1000 ease-in-out`}
                />
              </svg>
              <span className="absolute text-4xl font-bold text-white">{Math.round(visibility.score)}</span>
            </div>

            <div className="w-full grid grid-cols-2 gap-4 text-sm mt-4">
              <div className="bg-gray-900 p-3 rounded flex flex-col items-center">
                <Zap className="h-5 w-5 text-green-400 mb-1" />
                <span className="text-gray-400 text-xs">Aurora Prob</span>
                <span className="font-bold">{visibility.aurora_probability}%</span>
              </div>
              <div className="bg-gray-900 p-3 rounded flex flex-col items-center">
                <Cloud className="h-5 w-5 text-gray-400 mb-1" />
                <span className="text-gray-400 text-xs">Cloud Cover</span>
                <span className="font-bold">{visibility.cloud_cover}%</span>
              </div>
              <div className="bg-gray-900 p-3 rounded flex flex-col items-center col-span-2">
                <Moon className="h-5 w-5 text-yellow-100 mb-1" />
                <span className="text-gray-400 text-xs">Darkness (Moon/Sun/Bortle)</span>
                <span className="font-bold">{visibility.darkness.toFixed(1)}/100</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-gray-400 animate-pulse text-center mt-10">Calculating Score...</p>
        )}
      </div>
    </div>
  )
}

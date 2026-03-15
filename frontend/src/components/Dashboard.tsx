import { useState, useEffect } from 'react'
import axios from 'axios'
import { MapPin, Cloud, Moon, Zap, AlertTriangle } from 'lucide-react'

export default function Dashboard() {
  const [solarWind, setSolarWind] = useState<any>(null)
  const [visibility, setVisibility] = useState<any>(null)
  const [location, setLocation] = useState({ lat: 60.0, lon: -100.0, name: 'Default Location' })
  const [inputLat, setInputLat] = useState('60.0')
  const [inputLon, setInputLon] = useState('-100.0')

  useEffect(() => {
    // Load saved location
    const saved = localStorage.getItem('aurora_location')
    if (saved) {
      const parsed = JSON.parse(saved)
      setLocation(parsed)
      setInputLat(parsed.lat.toString())
      setInputLon(parsed.lon.toString())
    }

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

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
      {/* Location Settings */}
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
        <h2 className="text-xl font-bold mb-4 flex items-center"><MapPin className="mr-2 text-blue-400" /> Location Settings</h2>
        <div className="space-y-4">
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
          <button
            onClick={saveLocation}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition"
          >
            Save Location & Calc Score
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

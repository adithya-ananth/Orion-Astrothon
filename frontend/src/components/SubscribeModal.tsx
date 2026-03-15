import { useState } from 'react'
import axios from 'axios'
import { X } from 'lucide-react'

export default function SubscribeModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  if (!isOpen) return null

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setStatus('loading')
    try {
      const res = await axios.post('http://localhost:8000/api/subscribe', { email })
      if (res.data.message.includes('Success')) {
        setStatus('success')
        setMsg('You have been subscribed to Aurora Alerts!')
        setTimeout(() => onClose(), 2000)
      } else {
        setStatus('error')
        setMsg(res.data.message)
      }
    } catch (err) {
      setStatus('error')
      setMsg('Error subscribing. Try again.')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 p-6 rounded-xl w-full max-w-md shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X size={20} />
        </button>
        <h2 className="text-2xl font-bold mb-2">Subscribe to Alerts</h2>
        <p className="text-gray-400 mb-6 text-sm">
          Get notified when Bz drops below -7nT or a rapid dBz/dt substorm precursor is detected.
        </p>

        <form onSubmit={handleSubscribe} className="space-y-4">
          <div>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-50"
          >
            {status === 'loading' ? 'Subscribing...' : 'Subscribe Now'}
          </button>

          {status === 'success' && <p className="text-green-400 text-sm text-center">{msg}</p>}
          {status === 'error' && <p className="text-red-400 text-sm text-center">{msg}</p>}
        </form>
      </div>
    </div>
  )
}

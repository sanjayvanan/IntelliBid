// API Configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

console.log('Environment variables:', import.meta.env)
console.log('API_URL:', API_URL)

export default API_URL

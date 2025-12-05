import { useState } from "react"
import { useDispatch, useSelector } from 'react-redux'
import { signupUser } from '../features/authSlice'

const Signup = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const dispatch = useDispatch()
  const isLoading = useSelector((state) => state.auth.loading)
  const error = useSelector((state) => state.auth.error)

  const handleSubmit = async (e) => {
    e.preventDefault()

    await dispatch(signupUser({ email, password }))
  }

  return (
    <form className="signup" onSubmit={handleSubmit}>
      <p style={{color: "red"}}>If you’ve just arrived, please wait about 35 seconds for the backend to boot up.</p>
      <h3>Sign Up</h3>
      
      <label>Email address:</label>
      <input 
        type="email" 
        onChange={(e) => setEmail(e.target.value)} 
        value={email} 
      />
      <label>Password:</label>
      <input 
        type="password" 
        onChange={(e) => setPassword(e.target.value)} 
        value={password} 
      />

      <button disabled={isLoading}>Sign up</button>
      {error && <div className="error">{error}</div>}
    </form>
  )
}

export default Signup
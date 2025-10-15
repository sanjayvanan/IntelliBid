import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { logout } from '../features/authSlice'

const Navbar = () => {
  const dispatch = useDispatch()
  const user = useSelector((state) => state.auth.user)

  const handleClick = () => {
    dispatch(logout())
  }

  return (
    <header>
      <div className="container">
        <Link to="/">
          <h1>IntelliBid</h1>
        </Link>
        <nav>
          {user && (
            <div>
              <span>{user.email}</span>
              <button onClick={handleClick}>Log out</button>
            </div>
            
          )}
          {!user && (
            <div>
              <Link to="/login">Login</Link>
              <Link to="/signup">Signup</Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}

export default Navbar
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { logout } from '../features/authSlice'
import { useState, useRef, useEffect } from 'react'
import { fetchItems, resetItems } from '../features/itemsSlice'
import logoImg from '../assets/IntelliBid.png'
import "../styles/Navbar.css"

const Navbar = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const user = useSelector((state) => state.auth.user)

  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  const [searchTerm, setSearchTerm] = useState("")

  const handleSearch = (e) => {
    e.preventDefault()
    dispatch(resetItems())
    dispatch(fetchItems({ page: 1, search: searchTerm }))
    navigate('/') // Redirect to home to show results
  }

  // Function to reset everything when clicking the logo
  const handleLogoClick = () => {
    setSearchTerm("") 
    dispatch(resetItems()) 
    dispatch(fetchItems({ page: 1, search: "" }))
  }

  const handleLogout = () => {
    dispatch(logout())
    setIsDropdownOpen(false)
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="navbar">
      <div className="container">
        
        {/* Logo with Image & Text */}
        <Link to="/" className="logo" onClick={handleLogoClick}>
          <img src={logoImg} alt="IntelliBid Logo" className="logo-img" />
          <h1>IntelliBid</h1>
        </Link>

        {/* Search Input */}
        {user && 
        <form 
          className="search-form"
          onSubmit={handleSearch}
        >
          <input 
            type="text"
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button 
            type="submit"
            className="search-btn"
          >
            Search
          </button>
        </form>}
        

        {/* User Menu */}
        <nav className="nav-links">
          {user ? (
            <div className="user-menu" ref={dropdownRef}>
              <button 
                className="user-button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <div className="user-avatar">
                  {user.email.charAt(0).toUpperCase()}
                </div>
                <span className="user-email">{user.email}</span>
                <svg 
                  className={`chevron ${isDropdownOpen ? 'open' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M19 9l-7 7-7-7" 
                  />
                </svg>
              </button>

              {isDropdownOpen && (
                <div className="dropdown-menu">

                  <div className="dropdown-header">
                    <p className="dropdown-label">Signed in as</p>
                    <p className="dropdown-email">{user.email}</p>
                  </div>

                  <Link
                    to="/profile"
                    className="dropdown-item"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    Profile
                  </Link>

                  <Link
                    to="/add-item"
                    className="dropdown-item"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    Add Item
                  </Link>
                  <div className="dropdown-divider" />

                  <button
                    onClick={handleLogout}
                    className="dropdown-item logout"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="auth-links">
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
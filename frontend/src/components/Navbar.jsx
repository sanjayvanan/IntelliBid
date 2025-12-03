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
  const [isListening, setIsListening] = useState(false) // State for voice animation

  const handleSearch = (e) => {
    if (e) e.preventDefault()
    if (!searchTerm.trim()) return
    
    dispatch(resetItems())
    dispatch(fetchItems({ page: 1, search: searchTerm }))
    navigate('/') // Redirect to home to show results
  }

  // --- VOICE SEARCH LOGIC ---
  const handleVoiceSearch = () => {
    // Check browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Your browser does not support Voice Search. Try Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false; // Stop after one sentence
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setSearchTerm(transcript);
      
      // Auto-trigger search after voice input
      dispatch(resetItems());
      dispatch(fetchItems({ page: 1, search: transcript }));
      navigate('/');
    };

    recognition.onerror = (event) => {
      console.error("Voice Error:", event.error);
      setIsListening(false);
    };

    recognition.start();
  };

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

        {/* Search Form with Voice Button */}
        {user && 
        <form 
          className="search-form"
          onSubmit={handleSearch}
        >
          <div className="input-wrapper">
            <input 
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            
            {/* Voice Search Button */}
            <button 
              type="button" 
              className={`voice-btn ${isListening ? 'listening' : ''}`}
              onClick={handleVoiceSearch}
              title="Search by Voice"
            >
              {isListening ? (
                <span className="pulse-dot">●</span> 
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
              )}
            </button>
          </div>

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
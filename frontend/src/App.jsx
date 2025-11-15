import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'

// pages & components
import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Navbar from './components/Navbar'
import AddItems from './pages/AddItems'
import ItemDetails from './pages/ItemDetails'
import Profile from './pages/Profile'

function App() {
  const user = useSelector((state) => state.auth.user)

  return (
    <div className="App">

      <BrowserRouter>
        <Navbar />
        
        <div className="pages">
          <Routes>
            <Route 
              path="/" 
              element={user ? <Home /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/login" 
              element={!user ? <Login /> : <Navigate to="/" />} 
            />
            <Route 
              path="/signup" 
              element={!user ? <Signup /> : <Navigate to="/" />} 
            />
             <Route 
              path="/add-item" 
              element={<AddItems /> } 
            />
            <Route 
              path="/item-details/:id" 
              element={<ItemDetails /> } 
            />
            <Route 
              path="/profile" 
              element={<Profile /> } 
            />
            /profile

          </Routes>
          
        </div>
      </BrowserRouter>
    </div>
  );
}

export default App;

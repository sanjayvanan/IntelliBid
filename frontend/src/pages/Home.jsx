import { useSelector } from 'react-redux'

const Home = () => {
  const user = useSelector((state) => state.auth.user)

  return (
    <div className="home">
      <h2>Welcome{user ? `, ${user.email}` : ''}</h2>
      <p>You're logged in.</p>
    </div>
  )
}

export default Home
import { Link } from 'react-router-dom';
import DisplayItems from '../components/DisplayItems';
import '../styles/Home.css'; // Import the new styles
import { useSelector } from 'react-redux';

const Home = () => {

  const { currentSearchTerm } = useSelector((state) => state.items);


  const scrollToAuctions = () => {
    const section = document.getElementById('live-auctions');
    if (section) section.scrollIntoView({ behavior: 'smooth' });
  };


  return (
    <div className="home-page">
      
      {/* 1. Hero Section */}
      {!currentSearchTerm && (
        <>
          <section className="hero">
            <div className="blob blob-1"></div>
            <div className="blob blob-2"></div>
            
            <div className="hero-content">
              <h1>
                The Smart Way to <br />
                <span>Bid & Win</span>
              </h1>
              <p>
                Experience real-time auctions powered by AI. 
                Get instant valuations, smart insights, and win the items you love.
              </p>
              
              <div className="hero-buttons">
                <button onClick={scrollToAuctions} className="btn-primary">
                  Explore Auctions
                </button>
                <Link to="/add-item" className="btn-secondary">
                  Start Selling
                </Link>
              </div>
            </div>
          </section>

          <section className="stats-bar">
            <div className="stat">
              <span className="stat-num">Live</span>
              <span className="stat-label">Real-Time Bidding</span>
            </div>
            <div className="stat">
              <span className="stat-num">AI</span>
              <span className="stat-label">Powered Insights</span>
            </div>
            <div className="stat">
              <span className="stat-num">100%</span>
              <span className="stat-label">Secure Payments</span>
            </div>
          </section>
        </>
      )}

      {/* 3. The Grid (Existing Component) */}
      <section id="live-auctions" style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <DisplayItems />
      </section>

    </div>
  );
};

export default Home;
import { Link } from 'react-router-dom';

const RecommendationList = ({ recommendations, loading }) => {
  if (loading) return <p style={{ marginTop: '20px' }}>Finding similar items...</p>;
  
  if (!recommendations || recommendations.length === 0) return null;

  return (
    <div style={{ marginTop: '4rem', borderTop: '1px solid #eee', paddingTop: '2rem' }}>
      <h3>You might also be interested in</h3>
      <div className="items-grid" style={{ marginTop: '1rem' }}>
        {recommendations.map((item) => (
          <div key={item.id} className="auction-card">
            <Link to={`/item-details/${item.id}`}>
               {/* Reuse your existing card styling */}
              {item.image_url && (
                <div className="auction-image">
                  <img src={item.image_url} alt={item.name} />
                </div>
              )}
              <div className="auction-info">
                <h4 className="auction-title">{item.name}</h4>
                <p>Current Bid: ${item.current_price}</p>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecommendationList;
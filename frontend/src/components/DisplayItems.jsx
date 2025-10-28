import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchItems } from '../features/itemsSlice';
import { Link } from 'react-router-dom';
import './DisplayItems.css';

const DisplayItems = () => {
  const dispatch = useDispatch();
  const { items, loading } = useSelector((state) => state.items);

  useEffect(() => {
    dispatch(fetchItems());
  }, []);

  return (
    <div className="display-items">
      <h2>Current Auctions</h2>
      {loading && <div>Loading...</div>}

      <div className="items-grid">
        {items && items.map((item) => (
          <div key={item.id} className="auction-card">
            <Link to={`/item-details/${item.id}`}>
              {item.image_url && (
                <div className="auction-image">
                  <img src={item.image_url} alt={item.name} />
                </div>
              )}
              <div className="auction-info">
                <h3 className="auction-title">{item.name}</h3>
                <p><strong>Current Price:</strong> ${item.current_price}</p>
                <p><strong>Ends on:</strong> {new Date(item.end_time).toLocaleString()}</p>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DisplayItems;

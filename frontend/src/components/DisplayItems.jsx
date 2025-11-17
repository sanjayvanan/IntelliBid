// frontend/src/components/DisplayItems.jsx
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchItems } from '../features/itemsSlice';
import { Link } from 'react-router-dom';
import "../styles/DisplayItems.css"
import CountDownTimer from './CountDownTimer';

const DisplayItems = () => {
  const dispatch = useDispatch();
  const { items, loading } = useSelector((state) => state.items);

  useEffect(() => {
    dispatch(fetchItems());
  }, [dispatch]);

  return (
    <div className="display-items">
      <h2>Current Auctions</h2>
      {loading && <div>Loading...</div>}

      <div className="items-grid">
        {items && items.map((item) => {
          // Logic to extract the primary image (handle array or string)
          const itemImage = Array.isArray(item.image_url) 
            ? item.image_url[0] 
            : item.image_url;

          return (
            <div key={item.id} className="auction-card">
              <Link to={`/item-details/${item.id}`}>
                {itemImage && (
                  <div className="auction-image">
                    <img src={itemImage} alt={item.name} />
                  </div>
                )}
                <div className="auction-info">
                  <h3 className="auction-title">{item.name}</h3>
                  <p><strong>Current Price:</strong> ${item.current_price}</p>
                  <div><CountDownTimer startTime={item.start_time} endTime={item.end_time} /></div>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DisplayItems;
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchItems, resetItems } from '../features/itemsSlice';
import { Link } from 'react-router-dom';
import "../styles/DisplayItems.css"
import CountDownTimer from './CountDownTimer';
import { useInView } from 'react-intersection-observer'; // Import Observer

const DisplayItems = () => {
  const dispatch = useDispatch();
  const { items, loading, hasMore } = useSelector((state) => state.items);
  const [page, setPage] = useState(1);

 
  const { ref, inView } = useInView({
    threshold: 0, 
  });

  // 1. Initial Load: Reset list and fetch page 1
  useEffect(() => {
    dispatch(resetItems());
    dispatch(fetchItems({ page: 1 }));
    setPage(1);
  }, [dispatch]);

  // 2. Infinite Scroll: If the loading spinner is in view & we have more data, fetch next page
  useEffect(() => {
    if (inView && hasMore && !loading) {
      const nextPage = page + 1;
      dispatch(fetchItems({ page: nextPage }));
      setPage(nextPage);
    }
  }, [inView, hasMore, loading, page, dispatch]);

  return (
    <div className="display-items">
      <h2>Current Auctions</h2>

      <div className="items-grid">
        {items && items.map((item) => {
          const itemImage = Array.isArray(item.image_url) 
            ? item.image_url[0] 
            : item.image_url;

          return (
            <div key={item.id} className="auction-card">
              <Link to={`/item-details/${item.id}`}>
                {itemImage && (
                  <div className="auction-image">
                    <img src={itemImage} alt={item.name} loading="lazy" />
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

      {/* This div is the "Sensor". 
         When you scroll down and this becomes visible, 'inView' turns true.
      */}
      {hasMore && (
        <div ref={ref} style={{ textAlign: 'center', padding: '20px', marginTop: '20px' }}>
          {loading ? (
            <p>Loading more auctions...</p>
          ) : (
            <p style={{ color: '#ccc' }}>Scroll for more</p>
          )}
        </div>
      )}
      
      {!hasMore && items.length > 0 && (
        <p style={{ textAlign: 'center', margin: '20px', color: '#888' }}>
          You've reached the end!
        </p>
      )}
    </div>
  );
};

export default DisplayItems;
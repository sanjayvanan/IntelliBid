import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchItems, resetItems } from '../features/itemsSlice';
import { Link } from 'react-router-dom';
import "../styles/DisplayItems.css"
import CountDownTimer from './CountDownTimer';
import { useInView } from 'react-intersection-observer';

const DisplayItems = () => {
  const dispatch = useDispatch();
  // Get error state from store
  const { items, loading, hasMore, error } = useSelector((state) => state.items);
  const [page, setPage] = useState(1);

  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: '100px', // Load slightly before reaching bottom
  });

  // Initial Load
  useEffect(() => {
    dispatch(resetItems());
    dispatch(fetchItems({ page: 1 }));
    setPage(1);
  }, [dispatch]);

  // Infinite Scroll Logic
  useEffect(() => {
    // CRITICAL FIX: Added !error check. 
    // If there is an error (like 429), do NOT try to fetch the next page.
    if (inView && hasMore && !loading && !error) {
      const nextPage = page + 1;
      dispatch(fetchItems({ page: nextPage }));
      setPage(nextPage);
    }
  }, [inView, hasMore, loading, page, dispatch, error]);

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
                <div className="auction-image">
                   <span className="card-badge">Live</span>
                  
                  {itemImage ? (
                    <img 
                      src={itemImage} 
                      alt={item.name} 
                      loading="lazy"
                      style={{ transition: "opacity 0.3s", opacity: 0 }}
                      onLoad={(e) => e.target.style.opacity = 1} 
                    />
                  ) : (
                    <div style={{width: '100%', height: '100%', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999'}}>
                      No Image
                    </div>
                  )}
                </div>

                <div className="auction-info">
                  <h3 className="auction-title" title={item.name}>{item.name}</h3>
                  
                  <div className="price-row">
                    <span className="price-label">Current Bid</span>
                    <span className="current-price">${item.current_price}</span>
                  </div>

                  <div className="timer-wrapper">
                    <svg className="timer-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <CountDownTimer startTime={item.start_time} endTime={item.end_time} />
                  </div>
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      {/* Error Message Display */}
      {error && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#e7195a', fontWeight: 'bold' }}>
          {error}. Please refresh the page to try again.
        </div>
      )}

      {/* Infinite Scroll Sensor */}
      {/* Only show loader if we have more AND no error */}
      {hasMore && !error && (
        <div ref={ref} className="scroll-trigger">
          {loading ? (
            <span className="loading-text">
              <svg className="animate-spin" style={{width: '20px'}} fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading more auctions...
            </span>
          ) : (
            <span>Scroll for more</span>
          )}
        </div>
      )}
      
      {!hasMore && items.length > 0 && !error && (
        <div className="scroll-trigger">
          You've reached the end!
        </div>
      )}
    </div>
  );
};

export default DisplayItems;
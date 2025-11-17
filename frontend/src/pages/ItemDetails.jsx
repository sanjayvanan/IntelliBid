// ItemDetails.jsx
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import API_URL from "../config/api";
import "../styles/ItemDetails.css";
import { useSelector } from "react-redux";
import BiddingForm from "../components/BiddingForm";
import CountDownTimer from "../components/CountDownTimer";
import { io } from "socket.io-client";
import RecommendationList from "../components/RecommendationList";
import useFetch from "../hooks/useFetch";

const ItemDetails = () => {
  const user = useSelector((state) => state.auth.user);
  const token = user?.token;

  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ⬇️ Function to reload item data after placing a bid  // 
  const refreshItem = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/items/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setItem(res.data);
    } catch (e) {
      console.error("Failed to refresh item:", e);
    }
  };

  // 3. Fetch Recommendations using the hook (Updates when ID changes)
  const { 
    data: recommendations, 
    isPending: recLoading 
  } = useFetch(`${API_URL}/api/items/recommend/${id}`);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API_URL}/api/items/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        setItem(res.data);
      } catch (e) {
        setError("Could not load item details.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);


  //Websocket Listener
  useEffect(() => {
    // Connect to the backend URL
    const socket = io(API_URL);

    socket.on("connect", () => {
      console.log("Connected to WebSocket");
    });

    // Listen for 'bid_placed' event emitted by the controller
    socket.on("bid_placed", (data) => {
      // Only update if the event is for the item we are currently viewing
      if (data.itemId === id) {
        console.log("Real-time update received:", data);
        setItem((prevItem) => ({
          ...prevItem,
          current_price: data.current_price
        }));
      }
    });

    // Cleanup connection when component unmounts
    return () => {
      socket.disconnect();
    };
  }, [id]);

  if (loading) return <div className="center-text">Loading...</div>;
  if (error) return <div className="center-text error">{error}</div>;
  if (!item) return <div className="center-text">No item found</div>;

  const {
    name,
    description,
    start_price,
    current_price,
    image_url,
    start_time,
    end_time,
    status,
    category_id,
  } = item;

  const formatDate = (d) =>
    new Date(d).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <main className="item-page">
      <div className="container">
        <div className="item-grid">
          <figure className="item-media">
            <img src={image_url} alt={name} />
          </figure>

          <section className="item-info">
            <h1 className="item-title">{name}</h1>
            <p className="item-desc">{description}</p>

            <p>
              Auction <CountDownTimer startTime={start_time} endTime={end_time} />
            </p>

            <div className="meta-grid">
              <div>
                <span className="label">Start Price</span>
                <span className="value">${start_price}</span>
              </div>
              <div>
                <span className="label">Current Price</span>
                <span className="value">${current_price}</span>
              </div>
              <div>
                <span className="label">Start Time</span>
                <span className="value">{formatDate(start_time)}</span>
              </div>
              <div>
                <span className="label">End Time</span>
                <span className="value">{formatDate(end_time)}</span>
              </div>
              <div>
                <span className="label">Status</span>
                <span
                  className={`status-badge ${
                    status === "active" ? "active" : "ended"
                  }`}
                >
                  {status?.toUpperCase()}
                </span>
              </div>
              <div>
                <span className="label">Category</span>
                <span className="value">{category_id}</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* ⬇️ Pass refreshItem into BiddingForm */}
      <BiddingForm
        current_price={current_price}
        itemId={id}
        onBidSuccess={refreshItem}
      />

      <RecommendationList 
         recommendations={recommendations} 
         loading={recLoading} 
      />
    </main>
  );
};

export default ItemDetails;

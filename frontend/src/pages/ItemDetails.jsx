// frontend/src/pages/ItemDetails.jsx
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
  
  // State to toggle main image if user clicks a thumbnail
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Function to reload item data after placing a bid
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

  // Fetch Recommendations using the hook
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
  }, [id, token]);

  // Websocket Listener
  useEffect(() => {
    const socket = io(API_URL);

    socket.on("connect", () => {
      console.log("Connected to WebSocket");
    });

    socket.on("bid_placed", (data) => {
      if (data.itemId === id) {
        console.log("Real-time update received:", data);
        setItem((prevItem) => ({
          ...prevItem,
          current_price: data.current_price
        }));
      }
    });

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
    category_name,
  } = item;

  // Handle image_url whether it's a single string (legacy) or array
  const images = Array.isArray(image_url) ? image_url : [image_url].filter(Boolean);
  const mainImage = images[selectedImageIndex] || images[0];

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
            {/* Main Display Image */}
            <div style={{ 
              width: "100%", 
              height: "400px", 
              overflow: "hidden", 
              borderRadius: "12px",
              marginBottom: "16px",
              backgroundColor: "#f9f9f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
               {mainImage ? (
                 <img 
                   src={mainImage} 
                   alt={name} 
                   style={{ width: "100%", height: "100%", objectFit: "contain" }} 
                 />
               ) : (
                 <span style={{color: "#999"}}>No Image</span>
               )}
            </div>

            {/* Thumbnail Gallery */}
            {images.length > 1 && (
              <div style={{ display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "8px" }}>
                {images.map((img, idx) => (
                  <img 
                    key={idx} 
                    src={img} 
                    alt={`Thumbnail ${idx + 1}`} 
                    onClick={() => setSelectedImageIndex(idx)}
                    style={{ 
                      width: "70px", 
                      height: "70px", 
                      objectFit: "cover", 
                      borderRadius: "8px", 
                      cursor: "pointer",
                      border: selectedImageIndex === idx ? "2px solid #1aac83" : "2px solid transparent",
                      opacity: selectedImageIndex === idx ? 1 : 0.7,
                      transition: "all 0.2s"
                    }}
                  />
                ))}
              </div>
            )}
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
                <span className="value">{category_name ||category_id}</span>
              </div>
            </div>
          </section>
        </div>
      </div>

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
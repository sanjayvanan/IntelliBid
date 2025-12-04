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
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Function to refresh item data (e.g., after a bid)
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

  // Fetch Recommendations
  const { 
    data: recommendations, 
    isPending: recLoading 
  } = useFetch(`${API_URL}/api/items/recommend/${id}`);

  // Initial Fetch
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

  // Real-time updates via Socket.io
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
    seller_id,
    dynamic_details // <--- Extract dynamic attributes from DB
  } = item;
  
  const isOwner = user?.id === seller_id;
  const hasStarted = new Date() >= new Date(start_time);

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
          {/* LEFT: Image Gallery */}
          <figure className="item-media">
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

          {/* RIGHT: Info & Bidding */}
          <section className="item-info">
            <h1 className="item-title">{name}</h1>
            <p className="item-desc">{description}</p>

            <p>
              Auction <CountDownTimer startTime={start_time} endTime={end_time} />
            </p>

            {/* SPECS GRID */}
            <div className="meta-grid">
              {/* Standard Fields */}
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
                <span className="value">{category_name || category_id}</span>
              </div>

              {/* --- NEW: RENDER DYNAMIC ATTRIBUTES --- */}
              {dynamic_details && Object.keys(dynamic_details).length > 0 && 
                Object.entries(dynamic_details).map(([key, value]) => (
                  <div key={key}>
                    <span className="label">{key}</span>
                    <span className="value">{value}</span>
                  </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* --- BIDDING LOGIC --- */}
      {status !== "ended" ? (
        !hasStarted ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '15px', 
            marginTop: '30px', 
            backgroundColor: '#e0f2f1', 
            color: '#00695c',
            borderRadius: '8px',
            maxWidth: '600px',
            marginLeft: 'auto',
            marginRight: 'auto',
            border: '1px solid #b2dfdb'
          }}>
            <strong>Auction has not started yet.</strong>
            <p style={{ margin: '5px 0 0 0', fontSize: '0.9em' }}>
              Bidding opens at {formatDate(start_time)}
            </p>
          </div>
        ) : !isOwner ? (
          <BiddingForm
            current_price={current_price}
            itemId={id}
            onBidSuccess={refreshItem}
          />
        ) : (
          <div style={{ 
            textAlign: 'center', 
            padding: '15px', 
            marginTop: '30px', 
            backgroundColor: '#fff3cd', 
            color: '#856404',
            borderRadius: '8px',
            maxWidth: '600px',
            marginLeft: 'auto',
            marginRight: 'auto',
            border: '1px solid #ffeeba'
          }}>
            <strong>You are the seller of this item.</strong>
          </div>
        )
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '15px',
          marginTop: '30px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          borderRadius: '8px',
          maxWidth: '600px',
          marginLeft: 'auto',
          marginRight: 'auto',
          border: '1px solid #f5c6cb'
        }}>
          <strong>This auction has ended.</strong>
        </div>
      )}

      {/* Recommendations */}
      <RecommendationList 
         recommendations={recommendations} 
         loading={recLoading} 
      />
    </main>
  );
};

export default ItemDetails;
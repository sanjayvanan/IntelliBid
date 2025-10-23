// ItemDetails.jsx
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import API_URL from "../config/api";
import "../styles/ItemDetails.css";

const ItemDetails = () => {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API_URL}/api/items/${id}`,{
            headers: {
                Authorization: `Bearer ${JSON.parse(localStorage.getItem('user'))?.token}`,
            }
        });
        if (res.status !== 200) throw new Error("Failed to load item details");
        setItem(res.data);
      } catch (e) {
        console.error(e);
        setError("Could not load item details.");
      } finally {
        setLoading(false);
      }
    })();
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
    new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

  return (
    <main className="item-page">
      <div className="container">
        <div className="item-grid">
          <figure className="item-media">
            <img
              src={
                image_url ||
                "data:image/jpeg;base64,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"
              }
              alt={name}
            />
          </figure>

          <section className="item-info">
            <h1 className="item-title">{name}</h1>
            <p className="item-desc">{description}</p>

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
                <span className={`status-badge ${status === "active" ? "active" : "ended"}`}>
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
    </main>
  );
};

export default ItemDetails;

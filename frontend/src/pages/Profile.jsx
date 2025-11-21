import { useEffect, useState } from "react";
import axios from "axios";
import { useSelector } from "react-redux";
import API_URL from "../config/api";
// import "../styles/DisplayItems.css"; // Reusing styles for cards
import { Link } from "react-router-dom";
import "../styles/profile.css"
import AddressModal from "../components/AddressModal";

const Profile = () => {
  const user = useSelector((state) => state.auth.user);
  const [myItems, setMyItems] = useState([]);
  const [wonItems, setWonItems] = useState([]);
  const [error, setError] = useState(null);

  // --- NEW STATE FOR ADDRESS MODAL ---
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [selectedItemForPayment, setSelectedItemForPayment] = useState(null);

  useEffect(() => {
    if (user) {
      fetchMyItems();
      fetchWonItems();
    }
  }, [user]);

  const fetchMyItems = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/items/myItems`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setMyItems(res.data);
    } catch (err) {
      console.error(err);
    }
  };
  

  const fetchWonItems = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/items/won`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setWonItems(res.data);
    } catch (err) {
      console.error(err);
      setError("Could not fetch won items");
    }
  };

  // --- STEP 1: TRIGGER MODAL ---
  const handlePayClick = (item) => {
    setSelectedItemForPayment(item);
    setIsAddressModalOpen(true);
  };

  // --- STEP 2: HANDLE ADDRESS SUBMIT & START PAYMENT ---
  const handleAddressSubmit = (shippingAddress) => {
    setIsAddressModalOpen(false);
    if (selectedItemForPayment) {
      handlePayment(
        selectedItemForPayment.current_price,
        selectedItemForPayment.id,
        shippingAddress
      );
    }
  };

  // --- STEP 3: CORE PAYMENT LOGIC (Updated to accept address) ---
  const handlePayment = async (amount, itemId, shippingAddress) => {
    try {
      const orderUrl = `${API_URL}/api/payment/order`;
      const { data: order } = await axios.post(
        orderUrl,
        { amount, itemId },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "IntelliBid Auction",
        description: "Payment for won item",
        order_id: order.id,
        handler: async function (response) {
          try {
            const verifyUrl = `${API_URL}/api/payment/verify`;
            await axios.post(
              verifyUrl,
              {
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                itemId: itemId,
                shippingAddress: shippingAddress, // <--- Sending Address
              },
              { headers: { Authorization: `Bearer ${user.token}` } }
            );

            alert("Payment Successful!");
            fetchWonItems();
          } catch (error) {
            alert("Payment Verification Failed");
          }
        },
        prefill: {
          email: user.email,
        },
        theme: {
          color: "#1aac83",
        },
      };

      const rzp1 = new window.Razorpay(options);
      rzp1.open();
    } catch (error) {
      console.error("Payment Error:", error);
      alert("Unable to initiate payment");
    }
  };

  return (
    <div className="display-items profile-page">
      <div className="profile-header">
        <div>
          <h1>My Profile</h1>
          <p className="profile-email">Logged in as {user?.email}</p>
        </div>
      </div>

      {/* Items Won Section */}
      <div className="profile-section">
        <h2 className="profile-section-title profile-section-title--won">
          🏆 Auctions Won
        </h2>
        {error && <p className="error-text">{error}</p>}
        {wonItems.length === 0 && (
          <p className="empty-state">You haven’t won any auctions yet.</p>
        )}

        <div className="items-grid">
          {wonItems.map((item) => (
            <div key={item.id} className="auction-card auction-card--won">
              {/* Only top section is clickable */}
              <Link to={`/item-details/${item.id}`} className="auction-link">
                <div className="auction-info">
                  <h3 className="auction-title">{item.name}</h3>
                  <p className="auction-meta">
                    Winning Bid: <strong>${item.current_price}</strong>
                  </p>
                </div>
              </Link>

              {/* Payment section NOT inside Link */}
              <div className="payment-actions">
                {item.payment_status === "paid" ? (
                  <span className="payment-status payment-status--paid">
                    Paid ✓
                  </span>
                ) : (
                  <button
                    onClick={() => handlePayClick(item)} // Changed to open modal
                    className="payment-button"
                  >
                    Pay Now (UPI/Card)
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Items Sold Section */}
      <div className="profile-section">
        <h2 className="profile-section-title">My Listings</h2>
        {(!myItems || myItems.length === 0) && (
          <p className="empty-state">
            You don’t have any active listings yet.
          </p>
        )}
        <div className="items-grid">
          {myItems &&
            myItems.map((item) => (
              <Link
                key={item.id}
                to={`/item-details/${item.id}`}
                className="auction-link"
              >
                <div className="auction-card">
                  <div className="auction-info">
                    <h3 className="auction-title">{item.name}</h3>
                    <p className="auction-meta">Status: {item.status}</p>
                  </div>
                </div>
              </Link>
            ))}
        </div>
      </div>

      {/* --- ADDRESS MODAL COMPONENT --- */}
      <AddressModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        onSubmit={handleAddressSubmit}
      />
    </div>
  );
};

export default Profile;
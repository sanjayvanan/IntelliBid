import { useState } from 'react';
import axios from 'axios';

const BiddingForm = ({ current_price, id }) => {
  const [bidAmount, setBidAmount] = useState('');
  const [warning, setWarning] = useState('');

  const token = JSON.parse(localStorage.getItem("user"))?.token;

  // bid logic
  const handleBidChange = (e) => {
    const value = parseInt(e.target.value);
    setBidAmount(value);

    if (value <= current_price) {
      setWarning("Bid cannot be lower or same ... must be higher");
    } else {
      setWarning("");
    }
  };

  const handleBidSubmit = async (e) => {
    e.preventDefault();

    if (bidAmount > current_price) {
      try {
        const response = await axios.patch(
          `http://localhost:4000/api/items/bidup/${id}`,
          { bid_Amount: bidAmount },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        console.log("Bid updated:", response.data);
        alert("Bid placed successfully");
      } catch (error) {
        console.error("Error placing bid:", error);
        alert("Failed to place bid");
      }
    }
  };

  return (
    <div>
      <form onSubmit={handleBidSubmit}>
        <input type="number" onChange={handleBidChange} value={bidAmount} />
        <h1>{warning}</h1>
        <button type="submit" disabled={bidAmount <= current_price}>
          Bid
        </button>
      </form>
    </div>
  );
};

export default BiddingForm;

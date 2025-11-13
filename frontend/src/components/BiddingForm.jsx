import { useState } from 'react';
import { useSelector } from "react-redux";
import axios from 'axios';
import API_URL from "../config/api";

const BiddingForm = ({ current_price, itemId : id , onBidSuccess}) => {
  const [bidAmount, setBidAmount] = useState('');
  const [warning, setWarning] = useState('');

  const user = useSelector((state)=> state.auth.user);
  const token = user?.token;
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
          `${API_URL}/api/items/bidup/${id}`,
          { bidAmount: bidAmount },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        
        console.log("Bid updated:", response.data);
        onBidSuccess();
        setBidAmount('');
        alert("Bid placed successfully");
      } 
      catch (error) {
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

import { useState } from 'react';
import { useSelector } from "react-redux";
import axios from 'axios';
import API_URL from "../config/api";
import toast, { Toaster } from 'react-hot-toast';

const BiddingForm = ({ current_price, itemId : id , onBidSuccess}) => {
  const [bidAmount, setBidAmount] = useState('');
  const [warning, setWarning] = useState('');
  
  // 1. SAFELY CONVERT PRICE TO NUMBER
  // This prevents string concatenation errors (e.g. "100" + 1 = "1001")
  const numericPrice = parseFloat(current_price) || 0; 
  const MIN_INCREMENT = 1; 
  const minBidAmount = numericPrice + MIN_INCREMENT;

  const user = useSelector((state)=> state.auth.user);
  const token = user?.token;

  const handleBidChange = (e) => {
    const value = parseFloat(e.target.value); 
    setBidAmount(value);

    // Use the numeric variables for comparison
    if (value < minBidAmount) { 
      setWarning(`Your maximum bid must be at least $${minBidAmount.toFixed(2)}`);
    } else {
      setWarning("");
    }
  };

  const handleBidSubmit = async (e) => {
    e.preventDefault();

    if (bidAmount > numericPrice) {
      try {
        const response = await axios.patch(
          `${API_URL}/api/items/bidup/${id}`,
          { bidAmount: parseFloat(bidAmount).toFixed(2) }, // Ensure number format
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        
        onBidSuccess();
        setBidAmount('');
        toast.success(response.data.message || 'Maximum bid placed successfully!'); 
      } 
      catch (error) {
        console.error("Error placing bid:", error);
        const serverMessage = error.response?.data?.error;  
        toast.error(serverMessage || 'Failed to place proxy bid!');
      }
    }
  };

  return (
    <div style={{maxWidth: '600px', margin: '30px auto', padding: '20px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)'}}>
      <Toaster position="top-right" />
      <form onSubmit={handleBidSubmit}>
         <label style={{display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>Set Your Maximum Bid</label>
        
        <input 
          type="number" 
          onChange={handleBidChange} 
          value={bidAmount} 
          // 2. USE THE CALCULATED NUMERIC VARIABLES
          placeholder={`Enter your MAXIMUM bid (min $${minBidAmount.toFixed(2)})`} 
          min={minBidAmount}
          step="0.01" 
          style={{marginBottom: '10px'}}
        />
        
        {warning && <div className="error">{warning}</div>}
        
        <button 
            type="submit" 
            // 3. USE NUMERIC COMPARISON
            disabled={!bidAmount || bidAmount < minBidAmount}
            style={{width: '100%', padding: '12px', marginTop: '10px'}}
        >
          Set Proxy Bid
        </button>
        
        <p style={{fontSize: '0.85em', color: '#666', marginTop: '15px', textAlign: 'center'}}>
           Your bid will remain secret. The system will automatically bid the minimum amount necessary to keep you in the lead, up to your maximum.
        </p>
      </form>
    </div>
  );
};

export default BiddingForm;
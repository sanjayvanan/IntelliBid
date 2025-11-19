import { useState } from "react";

const AddressModal = ({ isOpen, onClose, onSubmit }) => {
  const [address, setAddress] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!address.trim()) return alert("Address is required");
    onSubmit(address); // Pass address back to parent
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h3>Shipping Details</h3>
        <p>Where should we ship your item?</p>
        <form onSubmit={handleSubmit}>
          <textarea
            rows="4"
            placeholder="Full Address (Street, City, Zip code)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            style={inputStyle}
          />
          <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
            <button type="submit" style={confirmBtnStyle}>Proceed to Pay</button>
            <button type="button" onClick={onClose} style={cancelBtnStyle}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Simple Inline Styles
const overlayStyle = {
  position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: "rgba(0,0,0,0.5)", display: "flex", 
  alignItems: "center", justifyContent: "center", zIndex: 1000
};
const modalStyle = {
  background: "white", padding: "20px", borderRadius: "8px", 
  width: "90%", maxWidth: "400px"
};
const inputStyle = {
  width: "100%", padding: "10px", marginTop: "10px", 
  borderRadius: "4px", border: "1px solid #ddd"
};
const confirmBtnStyle = {
  flex: 1, padding: "10px", background: "#1aac83", 
  color: "white", border: "none", borderRadius: "4px", cursor: "pointer"
};
const cancelBtnStyle = {
  flex: 1, padding: "10px", background: "#ccc", 
  color: "black", border: "none", borderRadius: "4px", cursor: "pointer"
};

export default AddressModal;
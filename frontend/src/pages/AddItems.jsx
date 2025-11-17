import { useState } from "react";
import axios from "axios";
import { useSelector } from "react-redux";
import API_URL from "../config/api";

export default function AddItems() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startPrice, setStartPrice] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [startTime, setStartTime] = useState("");     // datetime-local
  const [endTime, setEndTime] = useState("");         // datetime-local
  const [categoryId, setCategoryId] = useState("");
  const [files, setFiles] = useState([]); // Store multiple files
  const [msg, setMsg] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);

  // Access token from Redux store
  const user = useSelector((state) => state.auth.user);
  const token = user?.token;

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Check if the files array is empty
    if (!files || files.length === 0) return setMsg("Pick at least one image.");

    const form = new FormData();
    
    // Loop through the FileList and append each file with the key 'images'
    // This matches upload.array('images') in the backend
    for (let i = 0; i < files.length; i++) {
      form.append("images", files[i]);
    }

    form.append("name", name);
    form.append("description", description);
    form.append("start_price", startPrice || 0);
    form.append("current_price", currentPrice || startPrice || 0);
    
    // Convert datetime-local to ISO string if present
    if (startTime) form.append("start_time", new Date(startTime).toISOString());
    if (endTime) form.append("end_time", new Date(endTime).toISOString());
    form.append("category_id", categoryId || 1);

    try {
      const { data } = await axios.post(`${API_URL}/api/items`, form, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      setMsg("Created ✓");
      console.log(data);
      
      // Optional: Reset form here if desired
    } catch (err) {
      console.error(err);
      setMsg(err.response?.data?.error || "Failed to create item");
    }
  };

  const handleGenerateDescription = async () => {
    if (!name) {
      alert("Please enter an Item Name first!");
      return;
    }

    setIsGenerating(true);

    try {
      const res = await axios.post(
        `${API_URL}/api/items/generate-description`,
        { name, category: "General" }, // Placeholder category logic
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setDescription(res.data.description);
    } catch (error) {
      console.error(error);
      alert("Failed to generate description. Try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 480 }}>
      <label>Name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} required />

      <label>Description</label>
      <div style={{ display: "flex", gap: "10px" }}>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          style={{ 
            width: "100%", 
            padding: "10px", 
            borderRadius: "4px", 
            border: "1px solid #ddd",
            minHeight: "80px"
          }}
        />
      </div>
      <button 
        type="button" 
        onClick={handleGenerateDescription} 
        disabled={isGenerating}
        style={{ 
          marginTop: "5px", 
          marginBottom: "20px", 
          background: "#6366f1", 
          fontSize: "0.9rem"
        }}
      >
        {isGenerating ? "Generating..." : "✨ Auto-Generate with AI"}
      </button>

      <label>Start price</label>
      <input type="number" step="0.01" value={startPrice} onChange={(e) => setStartPrice(e.target.value)} required />

      <label>Current price</label>
      <input type="number" step="0.01" value={currentPrice} onChange={(e) => setCurrentPrice(e.target.value)} />

      <label>Start time</label>
      <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />

      <label>End time</label>
      <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />

      <label>Category ID</label>
      <input type="number" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} />

      <label>Images (Select multiple)</label>
      <input 
        type="file" 
        accept="image/*" 
        multiple // Allow multiple file selection
        onChange={(e) => setFiles(e.target.files)} 
        required 
      />
      
      {/* Simple preview of how many files are selected */}
      {files.length > 0 && (
        <p style={{ fontSize: "0.9rem", color: "#666", margin: "5px 0" }}>
          {files.length} file(s) selected
        </p>
      )}

      <button type="submit" style={{ marginTop: 8 }}>Submit</button>
      {msg && <p>{msg}</p>}
    </form>
  );
}
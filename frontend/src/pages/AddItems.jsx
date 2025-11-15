import { useState } from "react";
import axios from "axios";

export default function AddItems() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startPrice, setStartPrice] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [startTime, setStartTime] = useState("");     // datetime-local
  const [endTime, setEndTime] = useState("");         // datetime-local
  const [categoryId, setCategoryId] = useState("");
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return setMsg("Pick an image.");

    const form = new FormData();
    form.append("image", file); // ← MUST match multer.single('image')
    form.append("name", name);
    form.append("description", description);
    form.append("start_price", startPrice || 0);
    form.append("current_price", currentPrice || startPrice || 0);
    // Convert datetime-local to ISO string if present
    if (startTime) form.append("start_time", new Date(startTime).toISOString());
    if (endTime) form.append("end_time", new Date(endTime).toISOString());
    form.append("category_id", categoryId || 1);

    const token = JSON.parse(localStorage.getItem("user"))?.token;

    try {
      const { data } = await axios.post("http://localhost:4000/api/items", form, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      setMsg("Created ✓");
      console.log(data);
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
    const token = JSON.parse(localStorage.getItem("user"))?.token;

    try {
      const res = await axios.post(
        "http://localhost:4000/api/items/generate-description",
        { name, category: "General" }, // need to change this after i mapp the number to catagory
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

      <label>Image</label>
      <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} required />

      <button type="submit" style={{ marginTop: 8 }}>Submit</button>
      {msg && <p>{msg}</p>}
    </form>
  );
}

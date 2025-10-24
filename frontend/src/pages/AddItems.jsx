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

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 480 }}>
      <label>Name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} required />

      <label>Description</label>
      <input value={description} onChange={(e) => setDescription(e.target.value)} required />

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

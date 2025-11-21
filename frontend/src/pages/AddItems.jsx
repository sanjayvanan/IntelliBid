import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react"; 
import axios from "axios";
import { useSelector } from "react-redux";
import API_URL from "../config/api";

export default function AddItems() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startPrice, setStartPrice] = useState("");
  const [startTime, setStartTime] = useState("");     // datetime-local
  const [endTime, setEndTime] = useState("");         // datetime-local
  const [categoryId, setCategoryId] = useState("");
  const [files, setFiles] = useState([]); // Store multiple files
  const [msg, setMsg] = useState("");

  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);

  // Access token from Redux store
  const user = useSelector((state) => state.auth.user);
  const token = user?.token;



  const handleAnalyze = async () => {
    if (!name || !description || !startPrice) {
      alert("Please fill in Name, Description and Price first.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysis(null); // Reset previous result

    try {
      const { data } = await axios.post(
        `${API_URL}/api/items/analyze`,
        { name, description, start_price: startPrice },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAnalysis(data);
    } catch (err) {
      console.error(err);
      alert("Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };



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
    form.append("current_price", startPrice || 0);
    
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
            
      {/* --- START RAG FEATURE --- */}
      <div style={{ margin: "20px 0", padding: "15px", border: "1px dashed #ccc", borderRadius: "8px", background: "#fafafa" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <h4 style={{ margin: 0, color: "#555" }}>AI Market Appraiser</h4>
          <button 
            type="button" 
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            style={{ 
              background: "#4f46e5", 
              padding: "8px 16px",
              fontSize: "0.85rem" 
            }}
          >
            {isAnalyzing ? "Analyzing..." : "Analyze Price & Quality"}
          </button>
        </div>

        {analysis && (
          <div className="analysis-result" style={{ background: "white", padding: "15px", borderRadius: "6px", border: "1px solid #eee" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <span style={{ 
                fontWeight: "bold", 
                fontSize: "1.2rem", 
                color: analysis.score > 7 ? "#10b981" : "#f59e0b" 
              }}>
                Score: {analysis.score}/10
              </span>
              <span style={{ 
                background: "#e0e7ff", 
                color: "#3730a3", 
                padding: "4px 8px", 
                borderRadius: "4px", 
                fontSize: "0.8rem",
                fontWeight: "600"
              }}>
                Est. Value: {analysis.estimated_value}
              </span>
            </div>
            
            <p style={{ margin: "0 0 8px 0", fontSize: "0.9rem", color: "#333" }}>
              <strong>Verdict:</strong> {analysis.price_analysis}
            </p>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "#666", fontStyle: "italic" }}>
              "💡 {analysis.advice}"
            </p>
          </div>
        )}
      </div>
      {/* --- END RAG FEATURE --- */}

      <label>Start price</label>
      <input type="number" step="0.01" value={startPrice} onChange={(e) => setStartPrice(e.target.value)} required />

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
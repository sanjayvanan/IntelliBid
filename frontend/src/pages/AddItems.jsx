import { useState, useEffect } from "react";
import axios from "axios";
import { useSelector } from "react-redux";
import API_URL from "../config/api";
import "../styles/AddItems.css"; 

export default function AddItems() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startPrice, setStartPrice] = useState("");

  
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [condition, setCondition] = useState("New");
  const [categories, setCategories] = useState([]); 
  const [files, setFiles] = useState([]); 
  const [msg, setMsg] = useState("");

  // AI States
  const [isGenerating, setIsGenerating] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Preview Carousel
  const [previewIndex, setPreviewIndex] = useState(0);

  const user = useSelector((state) => state.auth.user);
  const token = user?.token;

  // Fetch Categories on Load
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/api/items/categories`);
        setCategories(data);
        // Default to first category if available
        if (data.length > 0) setCategoryId(data[0].id);
      } catch (err) {
        console.error("Failed to load categories", err);
      }
    };
    fetchCategories();
  }, []);

  const previewImages = files.length > 0 
    ? Array.from(files).map(file => URL.createObjectURL(file)) 
    : [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!files || files.length === 0) return setMsg("Pick at least one image.");

    const form = new FormData();
    for (let i = 0; i < files.length; i++) {
      form.append("images", files[i]);
    }

    form.append("name", name);
    form.append("description", description);
    form.append("start_price", startPrice || 0);
    form.append("current_price", startPrice || 0); // Set current to start price initially
    form.append("condition", condition);
    
    if (startTime) form.append("start_time", new Date(startTime).toISOString());
    if (endTime) form.append("end_time", new Date(endTime).toISOString());
    
    form.append("category_id", categoryId);

    try {
      await axios.post(`${API_URL}/api/items`, form, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      setMsg("Item Created Successfully! 🎉");
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
      // Find category name for better AI context
      const catName = categories.find(c => c.id == categoryId)?.name || "General";
      
      const res = await axios.post(
        `${API_URL}/api/items/generate-description`,
        { name, category: catName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDescription(res.data.description);
    } catch (error) {
      console.error(error);
      alert("Failed to generate description.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnalyze = async () => {
    if (!name || !description || !startPrice) {
      alert("Please fill in Name, Description and Price first.");
      return;
    }
    setIsAnalyzing(true);
    setAnalysis(null);
    try {
      const { data } = await axios.post(
        `${API_URL}/api/items/analyze`,
        { name, description, start_price: startPrice, condition },
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

  return (
    <div className="add-item-page">
      <div className="add-item-header">
        <h2>Create New Listing</h2>
        <p>Fill in the details below to launch your auction.</p>
      </div>

      {msg && <div className={`status-msg ${msg.includes("Success") ? "success" : "error"}`}>{msg}</div>}

      <div className="add-item-grid">
        {/* LEFT COLUMN: The Input Form */}
        <div className="form-section">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Item Name</label>
              <input 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="e.g. Vintage Canon Camera"
                required 
              />
            </div>

            <div className="form-group">
              <div className="label-row">
                <label>Description</label>
                <button 
                  type="button" 
                  onClick={handleGenerateDescription} 
                  disabled={isGenerating}
                  className="ai-gen-btn"
                >
                  {isGenerating ? "Writing..." : "✨ Auto-Write with AI"}
                </button>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows="5"
                placeholder="Describe condition, age, and features..."
              />
            </div>

            {/* UPDATED ROW: Price + Category */}
            <div className="form-row">
              <div className="form-group">
                <label>Start Price ($)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={startPrice} 
                  onChange={(e) => setStartPrice(e.target.value)} 
                  required 
                />
              </div>
              
              <div className="form-group">
                <label>Category</label>
                <select 
                  value={categoryId} 
                  onChange={(e) => setCategoryId(e.target.value)}
                  required
                >
                  <option value="" disabled>Select Category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* NEW ROW: Condition + Start Time */}
            <div className="form-row">
               <div className="form-group">
                  <label>Condition</label>
                  <select value={condition} onChange={(e) => setCondition(e.target.value)}>
                    <option value="New">New</option>
                    <option value="Like New">Used - Like New</option>
                    <option value="Good">Used - Good</option>
                    <option value="Fair">Used - Fair</option>
                    <option value="Poor">Used - Poor</option>
                  </select>
               </div>
               <div className="form-group">
                <label>Start Time</label>
                <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
            </div>

            <div className="form-group">
                <label>End Time</label>
                <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
            </div>

            <div className="form-group">
               <label>Upload Images</label>
               <div className="image-upload-box">
                 <input 
                   type="file" 
                   accept="image/*" 
                   multiple 
                   onChange={(e) => {
                     setFiles(e.target.files);
                     setPreviewIndex(0);
                   }} 
                   required 
                 />
                 <p className="upload-hint">
                   {files.length > 0 ? `${files.length} file(s) selected` : "Click to upload JPG or PNG (Max 5)"}
                 </p>
               </div>
            </div>

            <button type="submit" className="submit-btn">Launch Auction</button>
          </form>
        </div>

        {/* RIGHT COLUMN: Preview & AI Assistant */}
        <div className="sidebar-section">
          
          <div className="sidebar-card preview-container">
            <h3>Live Preview</h3>
            <div className="auction-card preview-card">
              <div className="auction-image">
                {previewImages.length > 0 ? (
                  <>
                    <img src={previewImages[previewIndex]} alt="Preview" />
                    {previewImages.length > 1 && (
                      <div className="preview-thumbnails">
                        {previewImages.map((img, idx) => (
                          <div 
                            key={idx}
                            className={`thumb-dot ${idx === previewIndex ? 'active' : ''}`}
                            onClick={() => setPreviewIndex(idx)}
                          >
                            <img src={img} alt="" />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="placeholder-img">Upload Image</div>
                )}
                <span className="card-badge">Live</span>
              </div>

              <div className="auction-info">
                <h3 className="auction-title">{name || "Your Item Name"}</h3>
                <div className="price-row">
                  <span className="price-label">Current Bid</span>
                  <span className="current-price">${startPrice || "0.00"}</span>
                </div>
                
                {/* Preview Condition Tag */}
                <div style={{marginTop: '8px'}}>
                   <span style={{fontSize: '0.75rem', background: '#f3f4f6', padding: '3px 8px', borderRadius: '4px', color: '#555'}}>
                     {condition}
                   </span>
                </div>
              </div>
            </div>
          </div>

          <div className="sidebar-card ai-panel">
            <div className="ai-header">
               <h3>🤖 AI Market Appraiser</h3>
            </div>
            
            {!analysis ? (
              <div className="ai-empty">
                <p>Fill in Name, Description & Price, then ask AI to check your listing.</p>
                <button onClick={handleAnalyze} disabled={isAnalyzing} className="ai-action-btn">
                  {isAnalyzing ? "Analyzing..." : "Analyze Price & Quality"}
                </button>
              </div>
            ) : (
              <div className="ai-result">
                 <div className="result-header">
                    <div className={`score-badge score-${analysis.score >= 7 ? 'high' : analysis.score >= 4 ? 'mid' : 'low'}`}>
                      Score: {analysis.score}/10
                    </div>
                    <span className="est-val">Est: {analysis.estimated_value}</span>
                 </div>
                 <div className="result-body">
                   <p><strong>Verdict:</strong> {analysis.price_analysis}</p>
                   <p className="ai-tip">💡 {analysis.advice}</p>
                 </div>
                 <div style={{marginTop: "10px", textAlign: "center"}}>
                    <span onClick={handleAnalyze} style={{cursor: "pointer", color: "#9ca3af", fontSize: "0.8rem", textDecoration: "underline"}}>
                        Re-Analyze
                    </span>
                 </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
// frontend/src/pages/EditItem.jsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useSelector } from "react-redux";
import API_URL from "../config/api";
import "../styles/AddItems.css"; // Reuse existing styles

export default function EditItem() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const token = user?.token;

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState([]);
  
  // Dynamic Attributes State
  const [attributeFields, setAttributeFields] = useState([]);
  const [attributeValues, setAttributeValues] = useState({});
  
  // UI States
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenAttributes, setIsGenAttributes] = useState(false);
  const [msg, setMsg] = useState("");

  // 1. Fetch Categories & Item Details on Mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Fetch Categories
        const catRes = await axios.get(`${API_URL}/api/items/categories`);
        setCategories(catRes.data);

        // Fetch Item Details
        const itemRes = await axios.get(`${API_URL}/api/items/${id}`);
        const item = itemRes.data;

        // Check ownership
        if (user?.id !== item.seller_id) {
          alert("You are not authorized to edit this item.");
          navigate("/");
          return;
        }

        // Populate State
        setName(item.name);
        setDescription(item.description);
        setCategoryId(item.category_id);
        
        if (item.dynamic_details) {
          setAttributeValues(item.dynamic_details);
          setAttributeFields(Object.keys(item.dynamic_details));
        }

        setLoading(false);
      } catch (err) {
        console.error("Failed to load item data", err);
        setMsg("Error loading item data.");
        setLoading(false);
      }
    };

    if (user) loadData();
  }, [id, user, navigate]);

  // --- AI Handlers (Reused) ---
  const handleGenerateAttributes = async () => {
    if (!name || !categoryId) return alert("Name and Category required.");
    setIsGenAttributes(true);
    try {
      const catName = categories.find(c => c.id == categoryId)?.name || "General";
      const { data } = await axios.post(
        `${API_URL}/api/items/generate-attributes`,
        { name, category: catName, categoryId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (Array.isArray(data) && data.length > 0) {
        setAttributeFields(data);
        // Merge with existing values so we don't lose filled data
        const newValues = { ...attributeValues };
        data.forEach(field => {
            if (!newValues[field]) newValues[field] = "";
        });
        setAttributeValues(newValues);
      } else {
        alert("No attributes detected.");
      }
    } catch (error) {
      console.error(error);
      alert("AI generation failed.");
    } finally {
      setIsGenAttributes(false);
    }
  };

  const handleGenerateDescription = async () => {
    setIsGenerating(true);
    try {
      const catName = categories.find(c => c.id == categoryId)?.name || "General";
      const res = await axios.post(
        `${API_URL}/api/items/generate-description`,
        { name, category: catName, attributes: attributeValues },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDescription(res.data.description);
    } catch (error) {
      console.error(error);
      alert("AI Description failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAttributeChange = (key, value) => {
    setAttributeValues(prev => ({ ...prev, [key]: value }));
  };

  // --- Submit Update ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");

    try {
      await axios.put(
        `${API_URL}/api/items/${id}`,
        {
          name,
          description,
          category_id: categoryId,
          dynamic_details: attributeValues
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      alert("Listing Updated Successfully!");
      navigate(`/item-details/${id}`);
    } catch (err) {
      console.error(err);
      // Handle the specific "Bids placed" error from backend
      setMsg(err.response?.data?.error || "Failed to update item");
    }
  };

  if (loading) return <div className="add-item-page">Loading...</div>;

  return (
    <div className="add-item-page">
      <div className="add-item-header">
        <h2>Edit Listing</h2>
        <p>Update your item details. Note: Price and Images cannot be changed once listed.</p>
      </div>

      {msg && <div className="status-msg error">{msg}</div>}

      <div className="add-item-grid" style={{ gridTemplateColumns: "1fr" }}> {/* Single column for edit */}
        <div className="form-section">
          <form onSubmit={handleSubmit}>
            
            {/* NAME */}
            <div className="form-group">
              <label>Item Name</label>
              <input 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
              />
            </div>

            {/* CATEGORY */}
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

            {/* DYNAMIC ATTRIBUTES */}
            <div style={{ marginBottom: "1.5rem", padding: "15px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
               <div className="label-row">
                 <label style={{marginBottom: 0, fontWeight: 600, color: "#334155"}}>Item Specifics</label>
                 <button 
                   type="button" 
                   onClick={handleGenerateAttributes} 
                   disabled={isGenAttributes}
                   className="ai-gen-btn"
                 >
                   {isGenAttributes ? "Detecting..." : "✨ Refresh Fields"}
                 </button>
               </div>
               
               <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "15px" }}>
                 {attributeFields.map((field) => (
                   <div key={field}>
                     <label style={{fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase"}}>{field}</label>
                     <input 
                       type="text" 
                       value={attributeValues[field] || ""}
                       onChange={(e) => handleAttributeChange(field, e.target.value)}
                       style={{ padding: "8px", fontSize: "0.9rem" }}
                     />
                   </div>
                 ))}
               </div>
            </div>

            {/* DESCRIPTION */}
            <div className="form-group">
              <div className="label-row">
                <label>Description</label>
                <button 
                  type="button" 
                  onClick={handleGenerateDescription} 
                  disabled={isGenerating}
                  className="ai-gen-btn"
                >
                  {isGenerating ? "Writing..." : "✨ Rewrite with AI"}
                </button>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows="6"
              />
            </div>

            <div className="form-actions" style={{display: 'flex', gap: '15px'}}>
                <button type="submit" className="submit-btn">Save Changes</button>
                <button 
                    type="button" 
                    className="submit-btn" 
                    style={{backgroundColor: '#64748b'}}
                    onClick={() => navigate(`/item-details/${id}`)}
                >
                    Cancel
                </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
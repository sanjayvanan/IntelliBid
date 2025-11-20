import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API_URL from '../config/api.js';

export const fetchItems = createAsyncThunk(
  'items/fetchItems', 
  async ({ page = 1, limit = 12, search = '' } = {}, { rejectWithValue }) => {
    try {
      let url = `${API_URL}/api/items?page=${page}&limit=${limit}`;
      if (search) {
        url += `&search=${encodeURIComponent(search)}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok) return rejectWithValue('Failed to fetch items');
      
      return { items: data, page, limit, search }; 
    } catch (err) {
      return rejectWithValue('Network error');
    }
  }
);

const itemsSlice = createSlice({
  name: 'items',
  initialState: {
    items: [],
    loading: false,
    error: null,
    hasMore: true,
    currentSearchTerm: '', // Store this!
  },
  reducers: {
    resetItems: (state) => {
      state.items = [];
      state.hasMore = true;
      state.currentSearchTerm = ''; // Optional: reset search on manual clear
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchItems.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchItems.fulfilled, (state, action) => {
        state.loading = false;
        const { items, page, limit, search } = action.payload;

        // Update current search term
        state.currentSearchTerm = search;

        if (page === 1) {
          state.items = items;
        } else {
          state.items = [...state.items, ...items];
        }

        if (items.length < limit) {
          state.hasMore = false;
        } else {
           // Re-enable loading if we got a full page (mostly for edge case where user clears search)
           state.hasMore = true; 
        }
      })
      .addCase(fetchItems.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { resetItems } = itemsSlice.actions;
export default itemsSlice.reducer;
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API_URL from '../config/api.js';

export const fetchItems = createAsyncThunk(
  'items/fetchItems', 
  // 1. Set default limit 
  async ({ page = 1, limit = 12 } = {}, { rejectWithValue }) => {
    try {
      const response = await fetch(`${API_URL}/api/items?page=${page}&limit=${limit}`);
      const data = await response.json();
      if (!response.ok) return rejectWithValue('Failed to fetch items');
      
      // 2. Pass the 'limit' used in this request back to the reducer
      return { items: data, page, limit }; 
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
  },
  reducers: {
    resetItems: (state) => {
      state.items = [];
      state.hasMore = true;
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
        // 3. Destructure limit from payload
        const { items, page, limit } = action.payload;

        if (page === 1) {
          state.items = items;
        } else {
          state.items = [...state.items, ...items];
        }

        // If we asked for 4 and got fewer than 4, we are at the end.
        if (items.length < limit) {
          state.hasMore = false;
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
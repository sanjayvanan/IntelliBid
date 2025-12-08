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
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return rejectWithValue(errorData.error || `Request failed: ${response.status}`);
      }
      
      const data = await response.json();
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
    currentSearchTerm: '',
  },
  reducers: {
    resetItems: (state) => {
      state.items = [];
      state.hasMore = true;
      state.error = null;
      state.currentSearchTerm = '';
    },
    // Updates price instantly when socket event fires
    updateRealTimePrice: (state, action) => {
      const { itemId, current_price } = action.payload;
      const item = state.items.find((i) => i.id === itemId);
      if (item) {
        item.current_price = current_price;
      }
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

        state.currentSearchTerm = search;

        if (page === 1) {
          state.items = items;
        } else {
          // Filter out duplicates just in case
          const newItems = items.filter(
            newItem => !state.items.some(existingItem => existingItem.id === newItem.id)
          );
          state.items = [...state.items, ...newItems];
        }

        if (items.length < limit) {
          state.hasMore = false;
        } else {
           state.hasMore = true; 
        }
      })
      .addCase(fetchItems.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.hasMore = false; 
      });
  },
});

export const { resetItems, updateRealTimePrice } = itemsSlice.actions;
export default itemsSlice.reducer;
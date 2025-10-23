// frontend/src/features/itemsSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API_URL from '../config/api.js';

export const fetchItems = createAsyncThunk('items/fetchItems', async (_, { rejectWithValue }) => {
  try {
    const response = await fetch(`${API_URL}/api/items`);
    const data = await response.json();
    if (!response.ok) return rejectWithValue('Failed to fetch items');
    return data;
  } catch (err) {
    return rejectWithValue('Network error');
  }
});

const itemsSlice = createSlice({
  name: 'items',
  initialState: {
    items: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchItems.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchItems.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchItems.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default itemsSlice.reducer;
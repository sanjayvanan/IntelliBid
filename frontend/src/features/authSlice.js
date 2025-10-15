import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import API_URL from '../config/api.js'

const savedUser = (() => {
	try {
		const raw = localStorage.getItem('user')
		return raw ? JSON.parse(raw) : null
	} catch {
		return null
	}
})()

export const loginUser = createAsyncThunk(
	'auth/loginUser',
	async ({ email, password }, { rejectWithValue }) => {
		try {
			const response = await fetch(`${API_URL}/api/user/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			})
			const data = await response.json()
			if (!response.ok) return rejectWithValue(data?.error || 'Login failed')
			localStorage.setItem('user', JSON.stringify(data))
			return data
		} catch (err) {
			return rejectWithValue('Network error')
		}
	}
)

export const signupUser = createAsyncThunk(
	'auth/signupUser',
	async ({ email, password }, { rejectWithValue }) => {
		try {
			const response = await fetch(`${API_URL}/api/user/signup`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			})
			const data = await response.json()
			if (!response.ok) return rejectWithValue(data?.error || 'Signup failed')
			localStorage.setItem('user', JSON.stringify(data))
			return data
		} catch (err) {
			return rejectWithValue('Network error')
		}
	}
)

const authSlice = createSlice({
	name: 'auth',
	initialState: {
		user: savedUser,
		loading: false,
		error: null
	},
	reducers: {
		logout(state) {
			state.user = null
			localStorage.removeItem('user')
		}
	},
	extraReducers: (builder) => {
		builder
			.addCase(loginUser.pending, (state) => {
				state.loading = true
				state.error = null
			})
			.addCase(loginUser.fulfilled, (state, action) => {
				state.loading = false
				state.user = action.payload
			})
			.addCase(loginUser.rejected, (state, action) => {
				state.loading = false
				state.error = action.payload || 'Login failed'
			})
			.addCase(signupUser.pending, (state) => {
				state.loading = true
				state.error = null
			})
			.addCase(signupUser.fulfilled, (state, action) => {
				state.loading = false
				state.user = action.payload
			})
			.addCase(signupUser.rejected, (state, action) => {
				state.loading = false
				state.error = action.payload || 'Signup failed'
			})
	}
})

export const { logout } = authSlice.actions
export default authSlice.reducer


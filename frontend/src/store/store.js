import { configureStore } from '@reduxjs/toolkit'
import authReducer from '../features/authSlice'
import itemsReducer from '../features/itemsSlice'

export const store = configureStore({
	reducer: {
		auth: authReducer,
		items: itemsReducer,
	}
})

export default store


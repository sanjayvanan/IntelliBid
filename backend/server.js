require('dotenv').config()

const express = require('express')
const cors = require('cors')
const userRoutes = require('./routes/user')
const homeRoutes = require('./routes/items')

// express app
const app = express()

// middleware
app.use(cors({
  origin: 'http://localhost:5174',
  credentials: true
}))
app.use(express.json())

app.use((req, res, next) => {
  console.log(req.path, req.method)
  next()
})

// routes
app.use('/api/user', userRoutes)
app.use('/api/items', homeRoutes )

// connect to db and start server
const connectMongo = require('./db/mongo')

connectMongo()
  .then(() => {
    app.listen(process.env.PORT, () => {
      console.log('listening on port', process.env.PORT)
    })
  })
  .catch((err) => {
    console.error('Failed to start server:', err)
  })
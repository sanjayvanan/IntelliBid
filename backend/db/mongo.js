const mongoose = require('mongoose')

const connectMongo = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      // useNewUrlParser and useUnifiedTopology are defaults in modern mongoose
    })
    console.log('connected to MongoDB')
  } catch (err) {
    console.error('MongoDB connection error:', err)
    // exit process if DB connection fails to avoid starting the server in a bad state
    process.exit(1)
  }
}

module.exports = connectMongo

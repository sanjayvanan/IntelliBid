const express = require('express')
const router = express.Router()

const {getItems, createItem} = require('../controllers/itemsController')

requireAuth = require('../middleware/requireAuth')

// router.use(requireAuth)


router.get('/', getItems)
router.post('/', createItem)



module.exports = router
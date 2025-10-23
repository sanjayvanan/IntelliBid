const express = require('express')
const router = express.Router()

const {getItem, getItems, createItem} = require('../controllers/itemsController')

requireAuth = require('../middleware/requireAuth')




router.get('/', getItems)


router.use(requireAuth)




router.post('/', createItem)
router.get('/:id', getItem)



module.exports = router
const db = require('../db/postgres')


const getItem = async( req, res) => {
    const { id } = req.params;
    try{
        const query  ='SELECT * from items where id = $1';
        const { rows } = await db.query (query, [id]);
        if(rows.length === 0){
            return res.status(404).json({error : 'Item not found'});
        }
        return res.status(200).json(rows[0])
    }
    catch(error){
        res.status(400).json({error: error.message});
    }
}






const getItems = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM items WHERE status = $1 ORDER BY end_time ASC', ['active']);
    res.status(200).json(rows);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


const createItem = async (req, res) => {
  const { name, description, start_price, current_price, start_time, end_time, category_id } = req.body;
  
  // Convert seller_id to string safely
  const seller_id = req.user._id.toString();

  try {
    const queryText = `
      INSERT INTO items(name, description, start_price, current_price, start_time, end_time, category_id, seller_id)
      VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `;
    const values = [
      name,
      description,
      start_price,
      current_price ?? start_price,
      start_time ?? new Date(),
      end_time,
      category_id,
      seller_id,
    ];
    const { rows } = await db.query(queryText, values);
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};	




module.exports = {getItem, getItems, createItem };
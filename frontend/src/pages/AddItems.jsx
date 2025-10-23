import {useState} from 'react'
import axios from 'axios'
// name, description, start_price, current_price, start_time, end_time, category_id, seller_id

const AddItems = () => {
    const [name, setName] =useState('');
    const[description, setDescription] = useState('');
    const[startPrice, setStartPrice] = useState('');
    const[currentPrice, setCurrentPrice] = useState('');
    const[startTime, setStartTime] = useState('');
    const[endTime, setEndTime] = useState('');
    const[categoryId, setCategoryId] = useState('');

const handleSubmit = async(e) => {
    e.preventDefault();
    try{
        axios.post('http://localhost:4000/api/items',
            {name ,
            description,
            start_price: 500,
            current_price: 750,
            start_time: "2025-10-23T10:00:00Z",
            end_time: "2025-10-30T10:00:00Z",
            category_id: 1
            },
            {
    headers: {                      // ✅ must be inside `headers`
      Authorization: `Bearer ${JSON.parse(localStorage.getItem('user'))?.token}`,
      "Content-Type": "application/json",
    },}
        ).then((response) => {
        console.log(response.data);
    })

    }catch(error){
        console.error('Error adding item:', error);
    }
    
}


    return(
        <div>
            <form onSubmit={handleSubmit}>
                <label htmlFor="name">Name</label>
                <input type="text"
                 onChange={(e)=> setName(e.target.value)} 
                 value={name}
                 />

                 <label htmlFor="description">Description</label>
                 <input type="text" 
                  onChange={(e)=>setDescription(e.target.value)} 
                  value={description}
                  />



                <button type='submit'>Submit</button>
            </form>
        </div>
    )
}

export default AddItems;
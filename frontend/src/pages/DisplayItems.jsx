import axios from 'axios';
import {useState, useEffect} from 'react';

const DisplayItems = () => {
    const[listData, setListData] = useState([]);

    useEffect(() =>{
        axios.get('http://localhost:4000/api/items')
        .then((response) => {setListData(response.data)})
        .catch((error) => {console.error('Error fetching data:', error)});
    },[]);


    return(
        <div>
            
            {listData.map((item) =>(
                <div key={item.id}>
                    <p>Product Name : {item.name}</p>

                </div>
            ))}
        </div>
    )
}

export default DisplayItems;
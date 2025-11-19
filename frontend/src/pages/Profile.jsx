import useFetch from "../hooks/useFetch";
import API_URL from "../config/api";


const Profile = () => {
    const {data, isPending, error} = useFetch(`${API_URL}/api/items/myItems`)
    return(
        <div>
            <h1>It me da profile</h1>
            <h1>My Products</h1>

            <p>{error?.message}</p>
            
            {data && data.map((item) => (
                <div key={item.id}>
                     <p >{item.name}</p>
                </div>
               
            ))}
        </div>
    )
}

export default Profile;
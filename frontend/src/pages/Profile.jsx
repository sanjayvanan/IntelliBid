import useFetch from "../hooks/useFetch";
import API_URL from "../config/api";


const Profile = () => {
    const {data, isPending, error} = useFetch(`${API_URL}/api/items/myItems`)
    return(
        <div>
            <h1>It me da profile</h1>
            <p>{error?.message}</p>
            
            {data && (
        <pre>{JSON.stringify(data, null, 2)}</pre>
      )}
        </div>
    )
}

export default Profile;
import axios from "axios";
import { useState, useEffect } from "react";
import { useSelector } from "react-redux";

const useFetch = (url) => {
    const user = useSelector((state) => state.auth.user);
    const token = user?.token;

    const [data, setData] = useState(null);
    const [isPending, setIsPending] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsPending(true);
            try {
                const response = await axios.get(url, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setData(response.data);
                setError(null);
            } catch (err) {
                setError(err.message);
            } finally {
                setIsPending(false);
            }
        };

        if (url) fetchData(); // Only fetch if URL exists
    }, [url, token]); 

    return { data, isPending, error }; 
};

export default useFetch;
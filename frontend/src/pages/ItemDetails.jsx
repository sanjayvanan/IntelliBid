import { useParams } from "react-router-dom"


const itemDetails = () => {

    const { id } = useParams()

    return(
        <div>
            <p>Hello {id}</p>
        </div>
    )


}

export default itemDetails

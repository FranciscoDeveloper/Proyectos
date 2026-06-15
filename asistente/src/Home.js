import './Home.css'
import {useState} from 'react';
import { useNavigate } from "react-router-dom";

function Home(){
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [count,setCount] = useState(0);
  const sendBox = () =>{
    navigate("Chat/"+email)
  }

 return(<div className="container"><h4>ingrese su correo</h4>

<div class="row">
    <div class="col-sm-6">
    <input type="text" className="form-control-sm" placeholder="Ingresa tu email" onChange={event=> setEmail(event.target.value)} /> 
    {count} 
    </div>
    <div class="col-sm-6">
    <button className="btn btn-primary " type="button" onClick={sendBox}>Ingresar a Sala</button></div>
    <button className="btn btn-primary " type="button" onClick={()=>setCount(count+1)}>Incrementar</button>
    </div>
  </div>)
     
  

}

export default Home;
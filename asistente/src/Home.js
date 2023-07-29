import './Home.css'
import { Link } from 'react-router-dom';
import {useState} from 'react';

function Home(){

    const [email, setEmail] = useState('');
    
    const handleChange = event => {
      
      setEmail(event.target.value);
    };

 return(<div className="container"><h4>ingrese su correo</h4>
 <input type="text" className="form-control-sm" placeholder="Ingresa tu email" onChange={handleChange} />    
  <Link to={{pathname:"/Chat/"+email}} >
                      <button className="btn btn-primary " type="button">Ingresar a Sala</button></Link></div>)
}

export default Home;
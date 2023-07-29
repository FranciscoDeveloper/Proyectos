import Promps from './Promps';
import { Link, useParams } from 'react-router-dom';
import Boxs from './Boxs';
import { useState  } from 'react';
import GlobalSendedMessage from './GlobalSendedMessage';
interface Props {}

const Chat: React.FC<Props> = () =>{

  const { email } = useParams();
  const [isSendedMessage,setIsSendedMessage] = useState(false);
  const json= JSON.stringify({email:email})

    
    fetch('http://localhost:5000/messages/init', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: json
    })
    .then(response => response.json())
    .then(data => {
      console.log('Respuesta del servidor:', data);
    })
    .catch(error => {
      console.error('Error al enviar la solicitud:', error);
    });



   
  return (
    <div className="container">


      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="card mt-5">
            <div className="card-header">
              <div className="row">
                <div className="col-md-2">
                  <Link to="/Home">
                    <button className="btn btn-primary " type="button"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-arrow-return-left" viewBox="0 0 16 16">
                      <path fill-rule="evenodd" d="M14.5 1.5a.5.5 0 0 1 .5.5v4.8a2.5 2.5 0 0 1-2.5 2.5H2.707l3.347 3.346a.5.5 0 0 1-.708.708l-4.2-4.2a.5.5 0 0 1 0-.708l4-4a.5.5 0 1 1 .708.708L2.707 8.3H12.5A1.5 1.5 0 0 0 14 6.8V2a.5.5 0 0 1 .5-.5z" />
                    </svg></button></Link>
                </div>
                <div className="col-md-10"><h3>{email}</h3></div>
              </div>
            </div>
            <div className="card-body" style={{ height: '300px', overflowY: 'scroll' }}>
              {/* Chat messages will be displayed here */}
              <Boxs email={email} isSendedMessage={isSendedMessage}></Boxs>
              {/* Add more messages here */}
            </div>
            <div className="card-footer">
              <div className="input-group">
               <GlobalSendedMessage.Provider value={{isSendedMessage,setIsSendedMessage}}>
               <Promps email={email} ></Promps>
               </GlobalSendedMessage.Provider>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>)
}
export default Chat;

import React, { useState,useContext } from 'react';
import GlobalComment from './GlobalComment';
import GlobalSendedMessage from './GlobalSendedMessage';
import TextBox from './TextBox';

function Promps(email:any)  {

  const globalSendedMessage = useContext(GlobalSendedMessage);
  const [comment, setComment] = useState('');
  const { isSendedMessage = false, setIsSendedMessage } = globalSendedMessage || {};
  const handleClick = () => {

    fetch('http://localhost:5000/messages/addmessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user: email.email, comment: comment })
    })
      .then(response => response.json())
      .then(data => {
        console.log('Respuesta del servidor:', data);
      })
      .catch(error => {
        console.error('Error al enviar la solicitud:', error);
      });
      globalSendedMessage?.setIsSendedMessage(true);
      console.log(isSendedMessage);
  };
  return (<>
    <GlobalComment.Provider  value={{ comment, setComment }}>
      <TextBox></TextBox>
    </GlobalComment.Provider>
    <div className="input-group-append">
      <button className="btn btn-primary" type="button" onClick={handleClick}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-send" viewBox="0 0 16 16">
        <path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11ZM6.636 10.07l2.761 4.338L14.13 2.576 6.636 10.07Zm6.787-8.201L1.591 6.602l4.339 2.76 7.494-7.493Z" />
      </svg></button>
    </div>
  </>)
}

export default Promps;

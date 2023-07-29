import { useState,useEffect  } from 'react';
import GlobalSendedMessage from './GlobalSendedMessage';

function Boxs(email:any,isSendedMessage: boolean) {
    const [messages, setMessages] = useState( [{}]);
    
   // const intervalId = setInterval(()=>setWebhook(!webhook), 7777);
    useEffect (()=>{
            fetch("http://localhost:5000/messages/all?email="+email.email)
            .then((res) => res.json())
            .then(async (data) =>
              setMessages(data)
            );
        
       
   
    },[!isSendedMessage])
   
   
  
   // let conversatio1 = [{ "user": "John", "comment": " wenna hermano 1" }, { "user": "Alice", "comment": " que me hablai asi mono logi sapo y la ctm" }];
    const jsonConversation = JSON.parse(JSON.stringify(messages));

    return (<div>
        {
            jsonConversation.map((message: any, index: any) => (<div className="message" key={index}> <p> <strong>{message.user}:</strong> {message.comment} </p> </div>))
        }
      
    </div>
    )


}
export default Boxs;
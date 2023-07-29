import React, {  useContext } from 'react';
import GlobalComment from './GlobalComment';
function TextBox(){
    const { comment, setComment } = useContext(GlobalComment);
    const handleChange = (event) => {
        setComment(event.target.value);
      };
    return( <input type="text" className="form-control" placeholder="Type your message..."  onChange={handleChange}  />)
}

export default TextBox;
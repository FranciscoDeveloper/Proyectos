
import './App.css';
import { Route, Routes } from 'react-router-dom';
import Home from './Home';
import Chat from './Chat';
function App() {

  

  return (<> 
    <Routes>
      <Route path='/Home' Component={Home} />
      <Route path={'/Chat/:email'} Component={Chat} />
    </Routes>

    </>);
}


export default App;

import  {  createContext } from 'react';

export interface IsSendedMessageContextType {
    isSendedMessage: boolean;
    setIsSendedMessage: (isSendedMessage: boolean) => void;
  }
const GlobalSendedMessage= createContext<IsSendedMessageContextType | undefined>(undefined);
export default GlobalSendedMessage;

from flask import Flask, jsonify, request, make_response
from langchain.chat_models  import ChatOpenAI
from langchain.schema import HumanMessage
from flask_cors import CORS
import redis
import json
from datetime import datetime
app = Flask(__name__)
chat_model  = ChatOpenAI(openai_api_key="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")
MICROSERVICE_1_URL = ""
cors = CORS(app,resources={ "/messages/*":{"origins":"*","methods":['GET','POST']}})
redis  = redis.StrictRedis (host='localhost', port=6379, db=0)


#

@app.route('/messages/init',methods=['POST'])
def init_message():
   email = request.get_json().get('email')
   if redis.exists(email):
      return {"status":"already init chat"}
   else:
      redis.set(email,'[')
      return {"status":"init chat"}

@app.route('/messages/all',methods=['GET'])
def get_message():
   email = request.args.get('email')
   try:
      boxs = redis.get(email).decode('utf-8')
   except:
      print('error')
      return '[]'

   boxs = boxs[:-1]
   return boxs+']'

@app.route('/messages/addmessage',methods=['POST'])
def addMessage():
    
    human_message = [HumanMessage(content=request.get_json().get('comment'))]
    ia_message = chat_model.predict_messages(human_message).content
    json_box_template = {'user':'IA','comment':ia_message}
    append(request,json.dumps(request.get_json()))
    append(request,json.dumps(json_box_template))
    return {"status":"init conversation"}

def append(request,json):
   redis.append(request.get_json().get('user'),json+",")


if __name__ == '__main__':
    app.run(debug=True)
#cuando comience el chat, llamar la servidor para abrir una matris en redis "[" ,conforme avanza la interaccion se cargan los
#json en la matriz, cada vez que el cliente solicite los boxs, recogo la matriz de redis, creo un objeto en que cierro la matriz
#y la envio al cliente.
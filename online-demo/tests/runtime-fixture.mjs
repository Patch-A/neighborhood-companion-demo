import {requestCardSuggestion} from '../model.mjs';
export default {async fetch(){
  try{return Response.json({cards:await requestCardSuggestion({apiKey:'synthetic-runtime-fixture',model:'synthetic-model'},'想看看照片')});}
  catch(e){return Response.json({error:e.message},{status:e.status||503});}
}};

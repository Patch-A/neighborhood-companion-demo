import {Client,TablesDB,Query} from 'node-appwrite';
import {createHandler} from './handler.mjs';

const handle=createHandler();
export default async ({req,res})=>{
  const apiKey=process.env.FAMILY_AI_API_KEY;
  // Lazy store: a missing model secret still leaves a truthful manual demo available.
  let tablesDB;
  const databaseId=process.env.QMUSE_APPWRITE_DATABASE_ID;
  function db(){
    if(!databaseId||!process.env.APPWRITE_FUNCTION_API_ENDPOINT||!process.env.APPWRITE_FUNCTION_PROJECT_ID||!req.headers['x-appwrite-key'])throw Error('Cloud unavailable');
    if(!tablesDB){const client=new Client().setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT).setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID).setKey(req.headers['x-appwrite-key']);tablesDB=new TablesDB(client);}
    return tablesDB;
  }
  const store={
    async count(scope){return (await db().listRows({databaseId,tableId:'ai_quota_slots',queries:[Query.equal('scope',[scope]),Query.limit(1)]})).total;},
    async create(rowId,data){await db().createRow({databaseId,tableId:'ai_quota_slots',rowId,data,permissions:[]});},
    async purge(now){const expired=await db().listRows({databaseId,tableId:'ai_quota_slots',queries:[Query.lessThan('expiresAt',now),Query.limit(50)]});for(const row of expired.rows)await db().deleteRow({databaseId,tableId:'ai_quota_slots',rowId:row.$id});},
  };
  return handle({req,res},{apiKey,store});
};

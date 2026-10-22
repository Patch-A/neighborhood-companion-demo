import {
  Account,
  Functions,
  Client,
  ID,
  Permission,
  Query,
  Role,
  Storage,
  TablesDB,
} from "appwrite";
import {
  createQmuseAppwriteRuntime,
  type AppwriteAccountLike,
  type AppwriteRuntimeConfig,
  type Models,
  type QmuseRuntimeContext,
} from "@qmuse/appwrite-runtime-sdk";
import {cloudFailure} from "./cloudDiagnostics";

export const client = new Client();
export const account = new Account(client);
export const tablesDB = new TablesDB(client);
const appwriteStorage = new Storage(client);

function getInjectedAppwriteConfig(): AppwriteRuntimeConfig | undefined {
  const config = window.__MUSE__?.appwrite;
  if (!config) return undefined;
  return {
    endpoint: config.endpoint,
    projectId: config.projectId,
    databaseId: config.databaseId,
    storageBucketId: config.storageBucketId,
  };
}

function getMuseRuntime(): QmuseRuntimeContext {
  const muse = window.__MUSE__;
  const env = muse.env;
  if (env !== "dev" && env !== "prod") {
    throw new Error("QMuse runtime env must be dev or prod");
  }
  return {
    appId: muse.appId,
    env,
    domain: muse.domain,
  };
}

function getQmuseLoginUserId(): string | null {
  const userId = window.__TERN__?.user?.clientUser?.userId;
  return typeof userId === "string" && userId.trim() ? userId : null;
}

const runtimeAccount: AppwriteAccountLike = {
  get: () => account.get(),
  getSession: (input) => account.getSession(input),
  deleteSession: async (input) => {
    await account.deleteSession(input);
  },
  createAnonymousSession: () => account.createAnonymousSession(),
  createSession: (input) => account.createSession(input),
};

const runtime = createQmuseAppwriteRuntime({
  client,
  account: runtimeAccount,
  tablesDB,
  fileStorage: appwriteStorage,
  appwriteConfig: getInjectedAppwriteConfig(),
  getMuseRuntime,
  getQmuseLoginUserId,
});

export const initAppwrite = runtime.init;
export const getAppwriteClients = runtime.getClients;
export const getCurrentAppwriteUser = runtime.getCurrentUser;
export const refreshAppwriteSession = runtime.refreshSession;
export const listQmuseRows = runtime.listRows;
export const getQmuseRow = runtime.getRow;
export const createQmuseRow = runtime.createRow;
export const updateQmuseRow = runtime.updateRow;
export const deleteQmuseRow = runtime.deleteRow;
export const uploadQmuseFile = runtime.uploadFile;
export const listQmuseFiles = runtime.listFiles;
export const getQmuseFile = runtime.getFile;
export const getQmuseFileViewUrl = runtime.getFileViewUrl;
export const getQmuseFilePreviewUrl = runtime.getFilePreviewUrl;
export const getQmuseFileDownloadUrl = runtime.getFileDownloadUrl;

export type { Models };
export { ID, Permission, Query, Role };

const functions = new Functions(client);
export async function executeQmuseFunction({functionId,body}:{functionId:string;body?:string}){
  try{await initAppwrite();}catch(error){throw cloudFailure("SESSION",error);}
  try{return await functions.createExecution({functionId,body});}
  catch(error){if(!(error&&typeof error==="object"&&"code" in error&&Number(error.code)===401))throw cloudFailure("FUNCTION",error);}
  try{await refreshAppwriteSession();}catch(error){throw cloudFailure("SESSION",error);}
  try{return await functions.createExecution({functionId,body});}catch(error){throw cloudFailure("FUNCTION",error);}
}

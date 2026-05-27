import adminWorker from "../../../workers/admin.js";

export async function onRequest({ request, env }) {
  return adminWorker.fetch(request, env);
}

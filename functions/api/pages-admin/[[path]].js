import adminWorker from "../../../bookforge-ai/workers/admin.js";

export async function onRequest({ request, env }) {
  return adminWorker.fetch(request, env);
}

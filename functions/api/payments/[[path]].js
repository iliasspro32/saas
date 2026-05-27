import paymentsWorker from "../../../bookforge-ai/workers/payments.js";

export async function onRequest({ request, env }) {
  return paymentsWorker.fetch(request, env);
}

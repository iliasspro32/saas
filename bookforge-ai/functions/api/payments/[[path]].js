import paymentsWorker from "../../../workers/payments.js";

export async function onRequest({ request, env }) {
  return paymentsWorker.fetch(request, env);
}

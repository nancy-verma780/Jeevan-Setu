/**
 * Alerts through pluggable providers. In-app, SMS, WhatsApp and push are all
 * mock providers here: each message is written to the notifications outbox that
 * administrators can inspect. A real provider only has to implement send().
 * Phone numbers are stored masked; sensitive cases get minimal text.
 */
const mask = (phone) => (phone ? `${phone.slice(0, 5)}•••••${phone.slice(-2)}` : "");

function mockProvider(channel) {
  return {
    channel,
    send(store, { to, text, requestId }) {
      store.insert("notifications", {
        channel,
        to: to.startsWith("+") ? mask(to) : to,
        text,
        request_id: requestId,
        status: "sent (mock)",
        created_at: new Date().toISOString(),
      });
    },
  };
}

export const providers = {
  inapp: mockProvider("in-app"),
  sms: mockProvider("sms"),
  whatsapp: mockProvider("whatsapp"),
  push: mockProvider("push"),
};

function reporterPhone(store, request) {
  return store.get("users", request.reporter_id)?.phone ?? null;
}

/** Called for every request event. */
export function notifyEvent(store, request, type, data) {
  const code = request.public_code ?? `#${request.id}`;
  const quiet = request.sensitive;
  const generic = `JeevanSetu: there is an update on request ${code}. Open the app for details.`;
  const phone = reporterPhone(store, request);
  const toReporter = (channels, text) => {
    if (!phone) return;
    for (const c of channels) providers[c].send(store, { to: phone, text: quiet ? generic : text, requestId: request.id });
  };

  if (type === "SENT_TO_HOSPITAL") {
    const label = quiet ? "sensitive case, minimum details" : `${String(request.priority ?? "standard").replace("_", " ").toLowerCase()} priority`;
    providers.inapp.send(store, { to: data.hospital_name, text: `New request ${code} (${label}). Reply within the time shown.`, requestId: request.id });
  } else if (type === "HOSPITAL_DECLINED" || type === "HOSPITAL_TIMED_OUT") {
    toReporter(["sms"], `JeevanSetu: ${data.hospital_name} could not take the patient. Request ${code} has gone to the next hospital.`);
  } else if (type === "HOSPITAL_ACCEPTED") {
    toReporter(["sms", "whatsapp", "push"], `JeevanSetu: ${data.hospital_name} accepted request ${code}. A bed is held. Show this code at the emergency desk.`);
  } else if (type === "NO_SUITABLE_HOSPITAL") {
    toReporter(["sms", "push"], `JeevanSetu: no hospital could take request ${code}. Call 112 now.`);
  } else if (type === "PATIENT_ARRIVED") {
    toReporter(["push"], `JeevanSetu: the patient has arrived at ${data.hospital_name}.`);
    for (const contact of request.passport?.contacts ?? []) {
      providers.sms.send(store, { to: contact.phone, text: quiet ? generic : `JeevanSetu: ${contact.name ? contact.name + ", " : ""}your contact has arrived at ${data.hospital_name}.`, requestId: request.id });
    }
  }
}

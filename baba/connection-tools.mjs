// Tools Baba uses to help people connect their tools from the chat, and to call
// services connected with an API key. All run on our server (custom tools):
// secrets never pass through Claude or the chat.

export const connectionTools = [
  {
    type: "custom",
    name: "list_connections",
    description:
      "List what this workspace has connected: Google accounts (with the default one) and services added with an API key. Use it before using a connected tool if unsure, and after the user says they've connected something.",
    input_schema: { type: "object", properties: {} },
  },
  {
    type: "custom",
    name: "request_connection",
    description:
      "Start connecting a service that signs in with OAuth. Supported: \"google\" (Gmail, Drive, Sheets, Calendar), \"slack\", \"hubspot\" (contacts, deals) and \"microsoft\" (Outlook mail and calendar). Call it again to add another account. Shows a Connect button in the chat, or, if the workspace hasn't set up its Google app yet, a secure one-time setup card that becomes the Connect button. After calling it, stop and wait for the user.",
    input_schema: {
      type: "object",
      properties: {
        service: { type: "string", enum: ["google", "slack", "hubspot", "microsoft"] },
        reason: { type: "string", description: "One short sentence: why you need it (shown on the button card)" },
      },
      required: ["service", "reason"],
    },
  },
  {
    type: "custom",
    name: "request_api_key",
    description:
      "For a service that uses an API key (not sign-in): show the user a SECURE box in the chat to paste the key. The key goes straight to encrypted storage; you never see it. Before calling, find out (from your knowledge or the web) the service's API host and how it expects the key. In `instructions`, give short numbered steps telling the user where to create the key. After calling, stop and ask the user to paste it in the box and tell you when it's saved.",
    input_schema: {
      type: "object",
      properties: {
        service_name: { type: "string", description: "Short name, e.g. 'Airtable' or 'OpenWeather'" },
        api_host: { type: "string", description: "Host the key is used with, e.g. 'api.airtable.com' (no https://, no path)" },
        header_name: { type: "string", description: "Header carrying the key. Default 'Authorization'" },
        header_prefix: { type: "string", description: "Text before the key in the header, e.g. 'Bearer ' (default) or '' for none" },
        query_param: { type: "string", description: "Only if the API wants the key as a URL parameter instead of a header, e.g. 'appid'" },
        instructions: { type: "string", description: "Numbered steps telling the user where to create/copy the key" },
      },
      required: ["service_name", "api_host", "instructions"],
    },
  },
  {
    type: "custom",
    name: "api_request",
    description:
      "Call the API of a service connected with an API key. The server adds the key; requests can only go to that service's host. GET requests run straight away; POST/PUT/PATCH/DELETE wait for the user's approval in Baba.",
    input_schema: {
      type: "object",
      properties: {
        service_name: { type: "string", description: "As shown by list_connections" },
        method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] },
        path: { type: "string", description: "Path starting with /, e.g. /v0/appXYZ/Table%201" },
        query: { type: "object", description: "URL query parameters (optional)", additionalProperties: { type: "string" } },
        body: { description: "JSON body for POST/PUT/PATCH (optional)" },
      },
      required: ["service_name", "method", "path"],
    },
  },
];

export const CONNECTION_RULES = `
CONNECTING TOOLS FROM THE CHAT:
- When the user wants to connect a service, or a task needs one that isn't connected:
  * Google (Gmail, Drive, Sheets, Calendar): call request_connection with service "google". The first time,
    the workspace sets up its own Google app through a secure card in the chat (guide them step by step if they
    ask); after that it's a single Connect button. Several Google accounts can be connected; call it again to add
    another. Use the \`account\` field to pick one.
  * A service that uses an API key: explain in 1–2 lines what the key allows, then call request_api_key with
    clear steps for creating the key. Then use api_request to work with it.
  * Others that need sign-in (e.g. Slack, Microsoft, X/Twitter): say they're coming soon and offer an alternative.
- NEVER ask the user to paste a password, API key, token or client secret into the chat. Always use the secure
  box (request_api_key). If they paste one into the chat anyway, tell them to delete/revoke that key, create a new
  one, and add it through the secure box.
- After showing a Connect button or key box, stop and wait for the user to confirm, then check with
  list_connections before continuing.
`;

/**
 * Baba's tools for business memory, the knowledge base, website previews and
 * read-only database access. They run on our server (src/lib/workspace-tools/tools.ts).
 */

const tool = (name, description, properties = {}, required = []) => ({
  type: "custom",
  name,
  description,
  input_schema: { type: "object", properties, required },
});

export const workspaceTools = [
  tool("memory_list", "List the workspace's business memory: saved facts about the company, brand, products, audience, policies and writing style."),
  tool(
    "memory_save",
    "Save one useful, lasting fact about the user's business to memory (e.g. brand colours, target audience, preferred tone, product list). Only save what the user told you or confirmed; it's marked as your suggestion until they confirm it. Pass id to correct an existing entry.",
    {
      category: { type: "string", enum: ["company", "brand", "products", "audience", "policy", "style", "fact", "other"] },
      content: { type: "string", description: "One clear sentence or short list." },
      id: { type: "string", description: "Existing memory id to update (from memory_list)." },
    },
    ["category", "content"],
  ),
  tool("memory_delete", "Delete a memory entry (waits for the user's approval).", { id: { type: "string" } }, ["id"]),
  tool(
    "knowledge_search",
    "Search the documents the user added to the knowledge base (policies, SOPs, product catalogues, training material). Returns matching passages with their document titles. Use exact words likely to appear in the text.",
    { query: { type: "string" }, limit: { type: "integer", description: "Max passages (default 8, max 20)." } },
    ["query"],
  ),
  tool(
    "site_publish_preview",
    "Publish a website built in this conversation to a live preview link. First the site must be zipped into /mnt/session/outputs/<name>-site.zip with index.html at the top. Publishing the same zip name again creates a new version of the same site. Returns the preview URL.",
    {
      zip_file_name: { type: "string", description: "e.g. acme-site.zip" },
      site_name: { type: "string", description: "Human name for the site, e.g. Acme Dental." },
      site_id: { type: "string", description: "To publish a new version of a site from another conversation (from site_list)." },
      note: { type: "string", description: "What changed in this version." },
    },
    ["zip_file_name"],
  ),
  tool("site_list", "List this workspace's websites with their preview links and versions."),
  tool(
    "site_restore_version",
    "Roll a website's preview back to an earlier version (waits for the user's approval).",
    { site_id: { type: "string" }, version: { type: "integer" } },
    ["site_id", "version"],
  ),
  tool(
    "request_database_connection",
    "Show a secure form in the chat where the user connects a PostgreSQL or MySQL database (read-only). Never ask for database passwords in the chat.",
    { engine: { type: "string", enum: ["postgres", "mysql"] }, reason: { type: "string", description: "One sentence: why you need it." } },
  ),
  tool(
    "db_query",
    "Run ONE read-only SQL query (SELECT/WITH/SHOW/EXPLAIN) on a connected database and get the rows as a table. Changes are impossible: it runs in a read-only transaction with a 15-second limit. Explore first (e.g. information_schema.tables / columns), then aggregate in SQL instead of pulling many rows.",
    {
      connection: { type: "string", description: "Connection name (from list_connections); optional if only one." },
      sql: { type: "string" },
      max_rows: { type: "integer", description: "Default 200, max 1000." },
    },
    ["sql"],
  ),
];

export const WORKSPACE_RULES = `
MEMORY & KNOWLEDGE: the first message of a conversation includes the business memory. Reuse it instead of asking
again. When the user tells you a lasting fact about their business (brand, audience, products, tone, policies),
save it with memory_save. Never save guesses. For questions about the company's own policies, procedures or
products, search the knowledge base with knowledge_search first and say which document an answer came from.

WEBSITES: build with the specialists (see How you work), then call site_publish_preview with the zip name and share
the link. Previews are temporary (30 days) and private to people with the link. Real-domain/production publishing
isn't available yet. Restoring an older version uses site_restore_version (needs approval).

DATABASES: for data in the user's database, check list_connections; if none, call request_database_connection
(secure form; never ask for passwords in chat). Then use db_query. Access is read-only by design. Show the
SQL you ran with the results, and base every number on actual query results.
`;

# AEC Studio — MCP server

Exposes the studio's analytical engines over the **Model Context Protocol** so any
MCP host — **Claude Desktop, Claude Code, Cursor**, or your own LLM app — can use
the platform's capabilities as tools. The tools call the *same* pure engines the
web app uses, so there's one source of truth.

## Tools

| Tool | What it does |
|---|---|
| `massing_schedule` | Generate a parametric building massing (GFA / storeys / shape / taper / podium / tower / twist) → floor schedule + quantities + performance (façade, volume, slab concrete, embodied carbon, ROM cost, occupancy, parking, form factor, slenderness). |
| `analyze_zoning` | Site & zoning capacity + compliance from a site (W×D or polygon) + rules + proposed scheme → buildable area, max GFA, legal envelope, FAR/height/coverage/setback/sky-plane checks. |
| `parse_ifc` | Parse IFC (STEP/SPF text) → schema, element counts, distinct types, storeys, disciplines, quantity takeoff. |
| `score_suppliers` | Score & rank a supplier cohort (on-time, quality, lead time, price) → 0–100 composite + grades. |
| `compute_carbon` | Embodied carbon vs a baseline + GFA benchmark → total kgCO₂e, saving, intensity, rating. |
| `autodesk_list_models` | List native models in the studio's APS bucket (with URNs). *Needs APS keys.* |
| `autodesk_status` | Translation status + % for a model URN. *Needs APS keys.* |
| `autodesk_translate` | Start/force SVF2 translation of an uploaded native model. *Needs APS keys.* |
| `autodesk_properties` | Extract element properties (quantities, types, parameters) from a translated Revit/Navisworks model. *Needs APS keys.* |

The five engine tools need **no secrets** (deterministic). The four `autodesk_*`
tools query Autodesk Platform Services — set **`APS_CLIENT_ID`** and
**`APS_CLIENT_SECRET`** in this server's environment to enable them; without keys
they return a clear "not configured" message.

## Run

```bash
npm run mcp          # start the server (stdio transport)
npm run mcp:smoke    # spawn it + call tools end-to-end (verification)
```

## Register it with an MCP host

**Claude Desktop** — add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "aec-studio": {
      "command": "npx",
      "args": ["tsx", "/ABSOLUTE/PATH/TO/construction-analytics/mcp/server.ts"]
    }
  }
}
```

**Claude Code:**

```bash
claude mcp add aec-studio -- npx tsx /ABSOLUTE/PATH/TO/construction-analytics/mcp/server.ts
```

**Cursor** — add the same `mcpServers` block to `~/.cursor/mcp.json` (or the
project's `.cursor/mcp.json`).

Then ask the host things like *"generate a 40-storey L-shaped massing for 120,000 m²
and give me the façade area and embodied carbon"* or *"does a 9,000 m² / 14-storey
scheme fit FAR 4, 60 m height, 6 m setback on a 60×45 m site?"* — it will call
these tools.

## Remote (HTTP) transport

This server uses stdio (best for local hosts). For a hosted, multi-client setup,
swap `StdioServerTransport` for the SDK's Streamable HTTP transport behind an
auth'd endpoint.

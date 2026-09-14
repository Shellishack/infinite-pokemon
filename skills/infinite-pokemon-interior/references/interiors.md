# Interior design contract

Each room proposal has `sceneId`, `name`, `furniture`, and `rugs`. The context lists eligible room IDs, existing furniture, fixed spawn, and protected objects. Coordinates use the enclosing32×24 map grid. The rectangular floor is x9–22, y5–18 inclusive; every placement's full footprint must stay inside it. The exit tile at16,19 remains fixed and accessible.

Furniture:1–10 items, each with `kind` (`table`, `counter`, `bookcase`, `bed`), `name` (2–40 characters), `text` (5–180 characters), x/y integers, width1–5, height1–3. Furniture is solid and inspectable. Proposed furniture replaces the old furniture, not doors, NPCs or the terminal. Overlaps, blocked arrivals and inaccessible services/exits cause rejection.

Rugs:0–4 rectangles with x/y, width1–5, height1–4. Rugs are decorative, passable floor coverings. They cannot enlarge a room or create a doorway. Room names are3–48 characters. All proposals must obey the request's JSON schema.

Design examples rather than mandatory templates:
- Ranger cabin: clustered map table, bunk along a wall, supply bookshelf; keep the entrance and caretaker approach open.
- Shore station: navigation counter and chart cabinet, with a rug leading inward from the entrance.
- Archive: separated reading tables and bookcases, with clear loops between stacks.
- Rest house: beds along opposing walls, care counter at the back, a broad central aisle.

Use descriptions to connect furniture to established local lore. The engine, not text, implements healing, purchases, breeding and saving. Do not invent executable scripts, remote assets, unlisted furniture types, new service commands or unrestricted wall geometry.

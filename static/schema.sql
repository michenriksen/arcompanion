-- Core item information table
CREATE TABLE items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL,
    rarity TEXT NOT NULL,
    value INTEGER NOT NULL,
    weight_kg REAL NOT NULL,
    stack_size INTEGER,
    found_in TEXT, -- DEPRECATED: Use item_category_links table
    is_weapon BOOLEAN DEFAULT 0,
    blueprint_locked BOOLEAN DEFAULT 0,
    is_craftable BOOLEAN DEFAULT 0,
    effects TEXT, -- JSON blob for flexible effect data
    image_name TEXT NOT NULL, -- Icon filename (e.g., "anvil.png", "silencer_ii.png")
    updated_at TEXT NOT NULL
);

-- Crafting recipes: what ingredients are needed to craft an item
CREATE TABLE crafting_recipes (
    item_id TEXT NOT NULL,
    ingredient_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    PRIMARY KEY (item_id, ingredient_id),
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (ingredient_id) REFERENCES items(id) ON DELETE CASCADE
);

-- Crafting benches: which crafting stations can craft this item
CREATE TABLE crafting_benches (
    item_id TEXT NOT NULL,
    bench_type TEXT NOT NULL,
    station_level INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (item_id, bench_type),
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

-- Recycling outputs: what materials you get from recycling an item
CREATE TABLE recycling_outputs (
    item_id TEXT NOT NULL,
    output_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    PRIMARY KEY (item_id, output_id),
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (output_id) REFERENCES items(id) ON DELETE CASCADE
);

-- Salvaging outputs: what materials you get from salvaging an item
CREATE TABLE salvaging_outputs (
    item_id TEXT NOT NULL,
    output_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    PRIMARY KEY (item_id, output_id),
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (output_id) REFERENCES items(id) ON DELETE CASCADE
);

-- Item categories: distinct category names where items can be found
CREATE TABLE item_categories (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL
);

-- Item-to-category junction table
CREATE TABLE item_category_links (
    item_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    PRIMARY KEY (item_id, category_id),
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES item_categories(id) ON DELETE CASCADE
);

-- Indexes for common query patterns
CREATE INDEX idx_items_name ON items(name);
CREATE INDEX idx_items_type ON items(type);
CREATE INDEX idx_items_rarity ON items(rarity);
CREATE INDEX idx_items_is_weapon ON items(is_weapon);
CREATE INDEX idx_items_is_craftable ON items(is_craftable);
CREATE INDEX idx_crafting_recipes_ingredient ON crafting_recipes(ingredient_id);
CREATE INDEX idx_recycling_outputs_output ON recycling_outputs(output_id);
CREATE INDEX idx_salvaging_outputs_output ON salvaging_outputs(output_id);
CREATE INDEX idx_item_category_links_category ON item_category_links(category_id);

# Tree View Mode

The GTNH Calculator now includes a **Tree View** mode that provides an alternative way to plan your production chains.

## How to Use

1. **Switch to Tree View**: Click the "Tree View" button at the top of the menu panel.

2. **Select Root Product**: Click "Select Root Product" to open the NEI interface and choose your desired end product.

3. **Set Amount**: Adjust the amount of the final product you want to produce.

4. **Build the Tree**: 
   - Click "Select Recipe" on any item to choose how it's produced
   - The tree automatically expands to show all required inputs
   - Continue selecting recipes for each ingredient until you reach raw materials

5. **Configure Recipes**:
   - Click the voltage tier button (e.g., "MV", "HV") to cycle through available tiers
   - Click the "✕" button to remove a recipe and select a different one
   - Click the expand/collapse arrows (▶/▼) to show/hide ingredients

## Features

- **Visual Hierarchy**: See your entire production chain as a tree structure
- **Automatic Calculations**: Ingredient amounts update automatically based on your root product quantity
- **Interactive**: Click any item to see available recipes
- **Voltage Tier Control**: Easily adjust overclocking for each recipe
- **Persistent**: Tree data is saved with your page

## Differences from Recipe List Mode

| Feature | Recipe List Mode | Tree View Mode |
|---------|------------------|----------------|
| Layout | Linear list | Hierarchical tree |
| Recipe Selection | Manual addition | Click-to-expand |
| Amount Management | Per product | Cascading from root |
| Best For | Complex optimization with LP solver | Visual planning and exploration |

## Tips

- Start with your end goal (final product) and work backwards
- Use Tree View for initial planning, then switch to Recipe List for optimization
- Editable amounts appear at the root and on items without recipes
- Tree data is saved automatically when you switch modes or save your page

## Keyboard Shortcuts

- **Escape**: Close NEI panel
- **Ctrl+Z**: Undo (works across modes)

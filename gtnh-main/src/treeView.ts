import { ShowNei, ShowNeiMode, ShowNeiCallback, ShowOreDictItems } from "./nei.js";
import { Goods, Repository, Item, Fluid, Recipe, RecipeIoType, OreDict, RecipeInOut, IMemMappedObjectPrototype, RecipeObject } from "./repository.js";
import { IconBox } from "./itemIcon.js";
import { ShowTooltip } from "./tooltip.js";
import { formatAmount, voltageTier } from "./utils.js";
import { UpdateProject, page } from "./page.js";
import { machines, GetSingleBlockMachine } from "./machines.js";

const repository = Repository.current;
const RecipeIoTypePrototypes: IMemMappedObjectPrototype<RecipeObject>[] = [Item, OreDict, Fluid, Item, Fluid];

// Helper to safely get recipe items with timeout protection
function getSafeRecipeItems(recipe: Recipe): RecipeInOut[] {
    if (!recipe) return [];
    try {
        const slice = (recipe as any).GetSlice(5);
        
        // Check for absurdly large slices
        if (!slice || slice.length > 5000 || slice.length < 0 || !isFinite(slice.length)) {
            console.error("Invalid slice length for recipe:", recipe.id, slice?.length);
            return [];
        }
        
        const itemCount = slice.length / 5;
        
        // Sanity check on item count
        if (itemCount > 1000 || itemCount <= 0 || !isFinite(itemCount)) {
            console.error("Invalid item count for recipe:", recipe.id, itemCount);
            return [];
        }
        
        const recipeItems: RecipeInOut[] = [];
        let sliceIndex = 0;
        const startTime = performance.now();
        
        for (let j = 0; j < itemCount; j++) {
            // Timeout check
            if (performance.now() - startTime > 200) {
                console.error("Timeout while parsing recipe items for:", recipe.id, "at item", j);
                break;
            }
            
            const type = slice[sliceIndex++];
            const ptr = slice[sliceIndex++];
            const slot = slice[sliceIndex++];
            const amount = slice[sliceIndex++];
            const probability = slice[sliceIndex++];
            
            recipeItems.push({
                type: type,
                goodsPtr: ptr,
                goods: null as any, // Lazy load
                slot: slot,
                amount: amount,
                probability: probability / 100
            });
        }
        
        return recipeItems;
    } catch (error) {
        console.error("Error parsing recipe items for:", recipe.id, error);
        return [];
    }
}

// Helper to lazily load goods object for a RecipeInOut
function ensureGoodsLoaded(item: RecipeInOut): void {
    if (!item.goods) {
        const proto = RecipeIoTypePrototypes[item.type];
        item.goods = repository.GetObject(item.goodsPtr, proto);
    }
}

export type TreeNodeData = {
    iid: number;
    goods: Goods | OreDict;
    amount: number;
    recipe: Recipe | null;
    voltageTier: number;
    children: TreeNodeData[];
    expanded: boolean;
    satisfied: boolean; // Whether this ingredient is satisfied by a recipe
    oreDictSource?: OreDict; // If this goods came from an ore dictionary
};

let nextTreeIid = 0;
let treeRoot: TreeNodeData | null = null;
let treeContainer: HTMLElement;
let treeViewport: HTMLElement;
let treeView: HTMLElement;
let recipeMemory: Map<string, string> = new Map(); // goods ID -> recipe ID
let oreDictMemory: Map<string, string> = new Map(); // ore dict ID -> chosen variant goods ID

// Pan and zoom state
let scale = 1;
let translateX = 0;
let translateY = 0;
let isPanning = false;
let startX = 0;
let startY = 0;

// Helper to check if item should be auto-satisfied (no recipes or non-consumable)
function shouldAutoSatisfy(goods: Goods | OreDict): boolean {
    // Check if it's a non-consumable (circuits, molds, etc.)
    if (goods.name) {
        if (goods.name.includes("Programmed Circuit") ||
            goods.name.includes("Mold") ||
            goods.name.includes("Shape") ||
            goods.name.includes("Raw Stellar Plasma Mixture") ||
            goods.name.includes("Condensed Raw Stellar Plasma Mixture") ||
            goods.name.includes("Planet")) {
            return true;
        }
    }
    
    // Check if item has any recipes - goods.production is an Int32Array of recipe pointers
    // OreDict doesn't have production, so check if it exists first
    if (goods instanceof Goods && 'production' in goods) {
        return goods.production.length === 0;
    }
    
    // For OreDict or other items without production, consider them auto-satisfied
    return true;
}

// Helper to recursively check if node and all its children are satisfied
function isFullySatisfied(node: TreeNodeData): boolean {
    // If node has no recipe, check if it should be auto-satisfied
    if (!node.recipe) {
        return shouldAutoSatisfy(node.goods);
    }
    
    // Node has recipe, check if all children are satisfied
    if (node.children.length === 0) {
        return true; // Leaf node with recipe is satisfied
    }
    
    return node.children.every(child => isFullySatisfied(child));
}

function clearRecipeMemory() {
    if (recipeMemory.size === 0 && oreDictMemory.size === 0) {
        alert("No saved recipe choices to clear.");
        return;
    }
    
    const recipeCount = recipeMemory.size;
    const oreDictCount = oreDictMemory.size;
    
    if (confirm(`Clear ${recipeCount} saved recipe choice(s) and ${oreDictCount} ore dict selection(s)?`)) {
        recipeMemory.clear();
        oreDictMemory.clear();
        
        // Rebuild tree if one exists
        if (treeRoot && treeRoot.goods instanceof Goods) {
            const rootGoods = treeRoot.goods;
            const rootAmount = treeRoot.amount;
            SetTreeRoot(rootGoods, rootAmount);
        }
        
        alert("Recipe memory cleared!");
    }
}

function downloadTree() {
    if (!treeRoot) {
        alert("No tree to download. Please select a root product first.");
        return;
    }
    
    const treeData = ExportTreeData();
    const jsonString = JSON.stringify(treeData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${treeRoot.goods.name.replace(/[^a-z0-9]/gi, '_')}_tree.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importTree() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const treeData = JSON.parse(text);
            ImportTreeData(treeData);
            alert("Tree imported successfully!");
        } catch (error) {
            console.error('Failed to import tree:', error);
            alert("Failed to import tree. Please check the file format.");
        }
    };
    
    input.click();
}

function copyShareLink() {
    if (!treeRoot) {
        alert("No tree to share. Please select a root product first.");
        return;
    }
    
    const treeData = ExportTreeData();
    const jsonString = JSON.stringify(treeData);
    const compressed = btoa(encodeURIComponent(jsonString));
    const url = `${window.location.origin}${window.location.pathname}?tree=${compressed}`;
    
    navigator.clipboard.writeText(url).then(() => {
        alert("Share link copied to clipboard!");
    }).catch(() => {
        alert("Failed to copy link. URL: " + url);
    });
}

export function InitializeTreeView() {
    treeContainer = document.getElementById("tree-view-content")!;
    treeViewport = document.getElementById("tree-view-viewport")!;
    treeView = document.getElementById("tree-view")!;
    
    setupPanZoom();
    
    // Set up event delegation for tree actions
    treeContainer.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const action = target.dataset.action;
        const iid = target.dataset.iid ? parseInt(target.dataset.iid) : undefined;
        
        if (action === "toggle-expand" && iid !== undefined) {
            toggleNodeExpansion(iid);
        } else if (action === "select-recipe" && iid !== undefined) {
            showRecipeSelection(iid);
        } else if (action === "remove-recipe" && iid !== undefined) {
            removeRecipe(iid);
        } else if (action === "change-voltage" && iid !== undefined) {
            cycleVoltageTier(iid);
        }
        
        // Handle clicks on recipe input slots to select recipes for those inputs
        const slotElement = target.closest(".tree-recipe-slot");
        if (slotElement) {
            const slotIid = slotElement.getAttribute("data-tree-iid");
            if (slotIid) {
                const childIid = parseInt(slotIid);
                e.stopPropagation();
                showRecipeSelection(childIid);
            }
        }
    });

    // Handle right-click for ore dict variant selection
    treeContainer.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const target = e.target as HTMLElement;
        const slotElement = target.closest(".tree-recipe-slot");
        if (slotElement) {
            const slotIid = slotElement.getAttribute("data-tree-iid");
            if (slotIid) {
                const childIid = parseInt(slotIid);
                const node = findNodeByIid(childIid);
                if (node && node.oreDictSource) {
                    showOreDictSelection(node);
                }
            }
        }
    });

    // Handle amount changes
    treeContainer.addEventListener("change", (e) => {
        const target = e.target as HTMLInputElement;
        if (target.dataset.action === "update-amount") {
            const iid = parseInt(target.dataset.iid || "-1");
            const node = findNodeByIid(iid);
            if (node) {
                node.amount = parseFloat(target.value) || 1;
                updateChildAmounts(node);
                scheduleRender();
            }
        }
    });

    // Handle item icon clicks for showing NEI
    treeContainer.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        if (target instanceof IconBox) {
            const node = findNodeByIid(parseInt(target.dataset.treeIid || "-1"));
            if (node) {
                e.stopPropagation();
                showRecipeSelection(node.iid);
            }
        }
    });
}

function setupPanZoom() {
    // Zoom controls
    document.getElementById("tree-zoom-in")?.addEventListener("click", () => {
        zoomTo(scale * 1.1);
    });
    
    document.getElementById("tree-zoom-out")?.addEventListener("click", () => {
        zoomTo(scale / 1.1);
    });
    
    document.getElementById("tree-zoom-reset")?.addEventListener("click", () => {
        resetView();
    });
    
    // Fullscreen toggle
    document.getElementById("tree-fullscreen")?.addEventListener("click", () => {
        treeView.classList.toggle("tree-view-maximized");
    });
    
    // Clear recipe memory
    document.getElementById("tree-clear-memory")?.addEventListener("click", () => {
        clearRecipeMemory();
    });
    
    // Import tree
    document.getElementById("tree-import")?.addEventListener("click", () => {
        importTree();
    });
    
    // Download tree
    document.getElementById("tree-download")?.addEventListener("click", () => {
        downloadTree();
    });
    
    // Copy share link
    document.getElementById("tree-copy-link")?.addEventListener("click", () => {
        copyShareLink();
    });
    
    // Mouse wheel zoom
    treeViewport.addEventListener("wheel", (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.95 : 1.05;
        const newScale = scale * delta;
        
        // Calculate zoom center (mouse position)
        const rect = treeViewport.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Adjust translation to zoom towards mouse
        const dx = mouseX - (mouseX - translateX) * (newScale / scale);
        const dy = mouseY - (mouseY - translateY) * (newScale / scale);
        
        scale = Math.max(0.1, Math.min(5, newScale));
        translateX = dx;
        translateY = dy;
        
        updateTransform();
    }, { passive: false });
    
    // Pan with mouse drag
    treeViewport.addEventListener("mousedown", (e) => {
        // Only pan with left mouse button and not on interactive elements
        if (e.button !== 0) return;
        const target = e.target as HTMLElement;
        if (target.tagName === "BUTTON" || target.tagName === "INPUT" || target.closest("button") || target.closest("input")) {
            return;
        }
        
        isPanning = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
        treeViewport.style.cursor = "grabbing";
        e.preventDefault();
    });
    
    window.addEventListener("mousemove", (e) => {
        if (!isPanning) return;
        
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        updateTransform();
    });
    
    window.addEventListener("mouseup", () => {
        if (isPanning) {
            isPanning = false;
            treeViewport.style.cursor = "grab";
        }
    });
    
    // Touch support for mobile
    let lastTouchDistance = 0;
    
    treeViewport.addEventListener("touchstart", (e) => {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            isPanning = true;
            startX = touch.clientX - translateX;
            startY = touch.clientY - translateY;
        } else if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
        }
    });
    
    treeViewport.addEventListener("touchmove", (e) => {
        e.preventDefault();
        
        if (e.touches.length === 1 && isPanning) {
            const touch = e.touches[0];
            translateX = touch.clientX - startX;
            translateY = touch.clientY - startY;
            updateTransform();
        } else if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (lastTouchDistance > 0) {
                const delta = distance / lastTouchDistance;
                scale = Math.max(0.1, Math.min(5, scale * delta));
                updateTransform();
            }
            
            lastTouchDistance = distance;
        }
    }, { passive: false });
    
    treeViewport.addEventListener("touchend", () => {
        isPanning = false;
        lastTouchDistance = 0;
    });
}

function zoomTo(newScale: number) {
    scale = Math.max(0.1, Math.min(5, newScale));
    updateTransform();
}

function resetView() {
    scale = 1;
    const rect = treeViewport.getBoundingClientRect();
    translateX = rect.width / 2;
    translateY = rect.height / 2;
    updateTransform();
}

function updateTransform() {
    treeContainer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    treeContainer.style.transformOrigin = '0 0';
}

function updateChildAmounts(node: TreeNodeData) {
    if (!node.recipe) return;
    
    // Find output amount - need to load goods first
    let outputAmount = 1;
    const recipeItems = getSafeRecipeItems(node.recipe);
    const outputItems = recipeItems.filter(item => item.type === RecipeIoType.ItemOutput || item.type === RecipeIoType.FluidOutput);
    for (const item of outputItems) {
        ensureGoodsLoaded(item);
        if (item.goods.id === node.goods.id) {
            outputAmount = item.amount;
            break;
        }
    }
    
    const recipesNeeded = node.amount / outputAmount;
    
    for (const child of node.children) {
        // Find input item - need to load goods first
        let inputItem = null;
        for (const item of recipeItems) {
            ensureGoodsLoaded(item);
            if (item.goods.id === child.goods.id) {
                inputItem = item;
                break;
            }
        }
        if (inputItem) {
            child.amount = inputItem.amount * recipesNeeded;
        }
    }
}

export function SetTreeRoot(goods: Goods, amount: number = 1) {
    if (!goods || !goods.name) {
        console.error("Cannot set tree root with invalid goods:", goods);
        return;
    }
    
    treeRoot = {
        iid: nextTreeIid++,
        goods: goods,
        amount: amount,
        recipe: null,
        voltageTier: 0,
        children: [],
        expanded: false,
        satisfied: false
    };
    scheduleRender();
}

export function GetTreeRoot(): TreeNodeData | null {
    return treeRoot;
}

function findNodeByIid(iid: number, node: TreeNodeData | null = treeRoot): TreeNodeData | null {
    if (!node) return null;
    if (node.iid === iid) return node;
    
    for (const child of node.children) {
        const found = findNodeByIid(iid, child);
        if (found) return found;
    }
    
    return null;
}

function toggleNodeExpansion(iid: number) {
    const node = findNodeByIid(iid);
    if (!node) return;
    
    node.expanded = !node.expanded;
    scheduleRender();
}

let renderScheduled = false;

function scheduleRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    
    requestAnimationFrame(() => {
        renderScheduled = false;
        renderTree();
        saveTreeToPage();
    });
}

function showRecipeSelection(iid: number) {
    const node = findNodeByIid(iid);
    if (!node) return;
    
    const callback: ShowNeiCallback = {
        onSelectRecipe: (recipe: Recipe) => {
            setNodeRecipe(node, recipe);
        }
    };
    
    ShowNei(node.goods, ShowNeiMode.Production, callback);
}

function showOreDictSelection(node: TreeNodeData) {
    if (!node.oreDictSource) return;
    
    // Get items slice without loading full array
    const itemsSlice = (node.oreDictSource as any).GetSlice(6);
    if (itemsSlice.length <= 1) return;
    
    // Use NEI interface to show items from the ore dictionary
    const callback: ShowNeiCallback = {
        onSelectGoods: (selectedGoods: Goods) => {
            if (selectedGoods instanceof Item && selectedGoods.name) {
                // Store the selection in memory and update the node
                oreDictMemory.set(node.oreDictSource!.id, selectedGoods.id);
                node.goods = selectedGoods;
                node.recipe = null;
                node.satisfied = false;
                node.children = [];
                scheduleRender();
            }
        }
    };
    
    // Show NEI with just the ore dictionary items
    ShowOreDictItems(node.oreDictSource, callback);
}

function applyRecipeToAllMatchingNodes(goodsId: string, recipe: Recipe) {
    let updateCount = 0;
    const MAX_UPDATES = 100; // Limit to prevent infinite loops
    
    function traverseAndApply(node: TreeNodeData | null) {
        if (!node || updateCount >= MAX_UPDATES) return;
        
        // If this node has the same goods and doesn't already have this recipe
        if (node.goods.id === goodsId && node.recipe?.id !== recipe.id) {
            node.recipe = recipe;
            node.satisfied = true;
            node.expanded = true;
            node.children = [];
            buildNodeChildren(node);
            updateCount++;
        }
        
        // Recursively check children
        for (const child of node.children) {
            traverseAndApply(child);
        }
    }
    
    traverseAndApply(treeRoot);
    
    if (updateCount >= MAX_UPDATES) {
        console.warn(`Applied recipe to ${MAX_UPDATES} nodes (limit reached)`);
    }
}

function setNodeRecipe(node: TreeNodeData, recipe: Recipe) {
    node.recipe = recipe;
    node.satisfied = true;
    node.expanded = true;
    
    // Remember this recipe choice for this goods
    recipeMemory.set(node.goods.id, recipe.id);
    
    // Build children from recipe inputs first
    node.children = [];
    
    // Get recipe items safely
    const recipeItems = getSafeRecipeItems(recipe);
    if (recipeItems.length === 0) {
        console.warn("Recipe has no items, cannot build tree:", recipe.id);
        return;
    }
    
    // Calculate output amount - works for both GT and non-GT recipes
    const outputItems = recipeItems.filter(item => item.type === RecipeIoType.ItemOutput || item.type === RecipeIoType.FluidOutput);
    let outputAmount = 1;
    for (const item of outputItems) {
        ensureGoodsLoaded(item);
        if (item.goods.id === node.goods.id) {
            outputAmount = item.amount;
            break;
        }
    }
    
    const recipesNeeded = node.amount / outputAmount;
    
    // Group inputs by goods ID to combine duplicates
    const inputMap = new Map<string, { goods: Goods, amount: number, oreDictSource?: OreDict }>();
    
    // Add all inputs as children (excluding programmed circuits)
    for (const item of recipeItems) {
        // For Eye of Harmony recipes, skip all ItemInput (planets)
        if (recipe.recipeType.name === "Eye of Harmony" && item.type === RecipeIoType.ItemInput) {
            continue;
        }
        
        if (item.type === RecipeIoType.ItemInput || 
            item.type === RecipeIoType.FluidInput ||
            item.type === RecipeIoType.OreDictInput) {
            
            // Lazily load the goods object
            ensureGoodsLoaded(item);
            let goods = item.goods as Goods;
            let oreDictSource: OreDict | undefined = undefined;
            
            // Skip goods without valid names
            if (!goods || !goods.name) {
                continue;
            }
            
            // Skip programmed circuits
            if (goods.name.includes("Programmed Circuit")) {
                continue;
            }
            
            // Skip molds, raw stellar plasma mixture, and planets
            if (goods.name.includes("Mold") ||
                goods.name.includes("Shape") ||
                goods.name.includes("Raw Stellar Plasma Mixture") ||
                goods.name.includes("Condensed Raw Stellar Plasma Mixture") ||
                goods.name.includes("Planet")) {
                continue;
            }
            
            // For ore dictionary, check memory or use first variant
            if (item.type === RecipeIoType.OreDictInput && goods instanceof OreDict) {
                oreDictSource = goods; // Store the original ore dict
                
                // Get the items slice without creating full Item objects
                const itemsSlice = (goods as any).GetSlice(6);
                if (itemsSlice.length > 0) {
                    // Check if we have a remembered choice
                    const rememberedId = oreDictMemory.get(goods.id);
                    if (rememberedId) {
                        const rememberedGoods = Repository.current.GetById<Goods>(rememberedId);
                        if (rememberedGoods) {
                            goods = rememberedGoods;
                        } else {
                            // Use first item from slice
                            goods = repository.GetObject(itemsSlice[0], Item);
                        }
                    } else {
                        // Use first item from slice
                        goods = repository.GetObject(itemsSlice[0], Item);
                    }
                }
                
                // Validate the goods from ore dict has a name
                if (!goods || !goods.name) {
                    continue;
                }
            }
            
            const inputAmount = item.amount * recipesNeeded;
            
            // Group by goods ID
            if (inputMap.has(goods.id)) {
                inputMap.get(goods.id)!.amount += inputAmount;
            } else {
                inputMap.set(goods.id, { goods, amount: inputAmount, oreDictSource });
            }
        }
    }
    
    // Create child nodes from grouped inputs
    for (const { goods, amount, oreDictSource } of inputMap.values()) {
        const childNode: TreeNodeData = {
            iid: nextTreeIid++,
            goods: goods,
            amount: amount,
            recipe: null,
            voltageTier: node.voltageTier,
            children: [],
            expanded: false,
            satisfied: shouldAutoSatisfy(goods), // Auto-satisfy if no recipes or non-consumable
            oreDictSource: oreDictSource
        };
        
        // Check if we have a remembered recipe for this goods
        const rememberedRecipeId = recipeMemory.get(goods.id);
        if (rememberedRecipeId) {
            const rememberedRecipe = Repository.current.GetById<Recipe>(rememberedRecipeId);
            if (rememberedRecipe) {
                // Automatically apply the remembered recipe
                childNode.recipe = rememberedRecipe;
                childNode.satisfied = true;
                childNode.expanded = true;
                // Recursively build this node's children
                buildNodeChildren(childNode);
            }
        }
        
        node.children.push(childNode);
    }
    
    // Use deferred rendering to avoid blocking the UI
    scheduleRender();
}

function buildNodeChildren(node: TreeNodeData, depth: number = 0) {
    if (!node.recipe) return;
    
    // Prevent infinite recursion - limit to 50 levels deep
    if (depth > 50) {
        console.warn("Max recursion depth reached for node:", node.goods.id);
        return;
    }
    
    const recipe = node.recipe;
    
    // Get recipe items safely
    const recipeItems = getSafeRecipeItems(recipe);
    if (recipeItems.length === 0) {
        console.warn("Recipe has no items:", recipe.id);
        return;
    }
    
    // Calculate output amount - find the matching output and load its goods
    let outputAmount = 1;
    const outputItems = recipeItems.filter(item => item.type === RecipeIoType.ItemOutput || item.type === RecipeIoType.FluidOutput);
    for (const item of outputItems) {
        ensureGoodsLoaded(item);
        if (item.goods.id === node.goods.id) {
            outputAmount = item.amount;
            break;
        }
    }
    
    const recipesNeeded = node.amount / outputAmount;
    
    // Group inputs by goods ID to combine duplicates
    const inputMap = new Map<string, { goods: Goods, amount: number }>();
    
    for (const item of recipeItems) {
        // For Eye of Harmony recipes, skip all ItemInput (planets)
        if (recipe.recipeType.name === "Eye of Harmony" && item.type === RecipeIoType.ItemInput) {
            continue;
        }
        
        if (item.type === RecipeIoType.ItemInput || 
            item.type === RecipeIoType.FluidInput ||
            item.type === RecipeIoType.OreDictInput) {
            
            // Lazily load the goods object
            ensureGoodsLoaded(item);
            let goods = item.goods as Goods;
            
            // Skip goods without valid names
            if (!goods || !goods.name) {
                continue;
            }
            
            if (goods.name.includes("Programmed Circuit")) {
                continue;
            }
            
            // Skip molds, raw stellar plasma mixture, and planets
            if (goods.name.includes("Mold") ||
                goods.name.includes("Shape") ||
                goods.name.includes("Raw Stellar Plasma Mixture") ||
                goods.name.includes("Condensed Raw Stellar Plasma Mixture") ||
                goods.name.includes("Planet")) {
                continue;
            }
            
            if (item.type === RecipeIoType.OreDictInput && goods instanceof OreDict) {
                const itemsSlice = (goods as any).GetSlice(6);
                if (itemsSlice.length > 0) {
                    goods = repository.GetObject(itemsSlice[0], Item);
                }
                
                // Validate the goods from ore dict has a name
                if (!goods || !goods.name) {
                    continue;
                }
            }
            
            const inputAmount = item.amount * recipesNeeded;
            
            if (inputMap.has(goods.id)) {
                inputMap.get(goods.id)!.amount += inputAmount;
            } else {
                inputMap.set(goods.id, { goods, amount: inputAmount });
            }
        }
    }
    
    for (const { goods, amount } of inputMap.values()) {
        const childNode: TreeNodeData = {
            iid: nextTreeIid++,
            goods: goods,
            amount: amount,
            recipe: null,
            voltageTier: node.voltageTier,
            children: [],
            expanded: false,
            satisfied: false
        };
        
        const rememberedRecipeId = recipeMemory.get(goods.id);
        if (rememberedRecipeId) {
            const rememberedRecipe = Repository.current.GetById<Recipe>(rememberedRecipeId);
            if (rememberedRecipe) {
                childNode.recipe = rememberedRecipe;
                childNode.satisfied = true;
                childNode.expanded = true;
                buildNodeChildren(childNode, depth + 1);
            }
        }
        
        node.children.push(childNode);
    }
}

function saveTreeToPage() {
    try {
        if (treeRoot && page) {
            page.treeData = ExportTreeData();
            UpdateProject(true); // true = visual only, don't re-solve
        }
    } catch (error) {
        console.error("Error saving tree to page:", error);
    }
}

function removeRecipe(iid: number) {
    const node = findNodeByIid(iid);
    if (!node) return;
    
    node.recipe = null;
    node.satisfied = false;
    node.children = [];
    node.expanded = false;
    
    scheduleRender();
}

function cycleVoltageTier(iid: number) {
    const node = findNodeByIid(iid);
    if (!node || !node.recipe) return;
    
    node.voltageTier = (node.voltageTier + 1) % voltageTier.length;
    
    // Update children voltage tiers
    for (const child of node.children) {
        child.voltageTier = node.voltageTier;
    }
    
    scheduleRender();
}

function renderTree() {
    if (!treeRoot) {
        treeContainer.innerHTML = '<div class="tree-empty-state">Click "Select Root Product" to start building a tree</div>';
        updateTransform();
        return;
    }
    
    treeContainer.innerHTML = `<div class="tree-root">${renderNode(treeRoot, 0)}</div>`;
    
    // Center the tree on first render
    if (translateX === 0 && translateY === 0 && scale === 1) {
        const rect = treeViewport.getBoundingClientRect();
        translateX = rect.width / 2;
        translateY = rect.height / 2;
    }
    
    updateTransform();
}

function renderNode(node: TreeNodeData, depth: number): string {
    const hasChildren = node.children.length > 0;
    
    let html = `<div class="tree-node-wrapper" data-iid="${node.iid}">`;
    
    // Recipe card
    html += `<div class="tree-recipe-card ${!node.recipe ? 'no-recipe' : ''}">`;
    
    if (node.recipe) {
        // Recipe header
        html += `<div class="tree-card-header">`;
        html += `<span class="tree-recipe-name">${node.recipe.recipeType.name}</span>`;
        html += `<button class="tree-card-close" data-action="remove-recipe" data-iid="${node.iid}" title="Remove recipe">✕</button>`;
        html += `</div>`;
        
        // Recipe content - show all inputs
        html += `<div class="tree-card-recipe-display">`;
        
        // Inputs grid - always show them
        if (hasChildren) {
            html += `<div class="tree-recipe-inputs">`;
            for (const child of node.children) {
                const oreDictClass = child.oreDictSource ? 'has-ore-dict' : '';
                let oreDictItemCount = 0;
                if (child.oreDictSource) {
                    // Get item count without loading the full items array
                    oreDictItemCount = (child.oreDictSource as any).GetSlice(6).length;
                }
                const childName = child.goods.name;
                const oreDictTitle = child.oreDictSource ? ` (Right-click to change variant from ${oreDictItemCount} options)` : '';
                html += `<div class="tree-recipe-slot ${oreDictClass}" data-tree-iid="${child.iid}" title="Click to select recipe for ${childName}${oreDictTitle}">`;
                html += `<item-icon data-id="${child.goods.id}"></item-icon>`;
                html += `<span class="tree-slot-amount">${formatAmount(child.amount)}</span>`;
                if (isFullySatisfied(child)) {
                    html += `<span class="tree-slot-has-recipe">✓</span>`;
                }
                if (oreDictItemCount > 1) {
                    html += `<span class="tree-slot-ore-dict">⚙</span>`;
                }
                html += `</div>`;
            }
            html += `</div>`;
        }
        
        // Arrow
        html += `<div class="tree-recipe-arrow">→</div>`;
        
        // Output
        html += `<div class="tree-recipe-output">`;
        html += `<div class="tree-recipe-slot">`;
        html += `<item-icon data-id="${node.goods.id}"></item-icon>`;
        if (depth === 0) {
            html += `<input type="number" class="tree-slot-amount-input" 
                            value="${node.amount}" 
                            min="0.001" 
                            step="any"
                            data-action="update-amount" 
                            data-iid="${node.iid}">`;
        } else {
            html += `<span class="tree-slot-amount">${formatAmount(node.amount)}</span>`;
        }
        html += `</div>`;
        html += `</div>`;
        
        html += `</div>`; // tree-card-recipe-display
        
        // Expand/collapse button at bottom if has children
        if (hasChildren) {
            html += `<button class="tree-expand-toggle" data-action="toggle-expand" data-iid="${node.iid}">`;
            html += node.expanded ? 'Collapse Tree ▲' : 'Expand Tree ▼';
            html += `</button>`;
        }
    } else {
        // No recipe selected
        html += `<div class="tree-card-content">`;
        html += `<item-icon data-id="${node.goods.id}" data-tree-iid="${node.iid}"></item-icon>`;
        html += `<div class="tree-no-recipe-info">`;
        html += `<span class="tree-item-name">${node.goods.name}</span>`;
        if (depth === 0) {
            html += `<input type="number" class="tree-io-amount-input" 
                            value="${node.amount}" 
                            min="0.001" 
                            step="any"
                            data-action="update-amount" 
                            data-iid="${node.iid}">`;
        } else {
            html += `<span class="tree-io-amount">${formatAmount(node.amount)}</span>`;
        }
        html += `<button class="tree-btn tree-btn-select" data-action="select-recipe" data-iid="${node.iid}">Select Recipe</button>`;
        html += `</div>`;
        html += `</div>`;
    }
    
    html += `</div>`; // tree-recipe-card
    
    // Render children vertically with horizontal spreading if expanded
    if (node.expanded && hasChildren) {
        const isSingleChild = node.children.length === 1;
        const cssClass = isSingleChild ? 'single-child' : 'multiple-children';
        html += `<div class="tree-children-container">`;
        html += `<div class="tree-connector"></div>`;
        html += `<div class="tree-children-row ${cssClass}">`;
        for (const child of node.children) {
            html += renderNode(child, depth + 1);
        }
        html += `</div>`;
        html += `</div>`;
    }
    
    html += `</div>`; // tree-node-wrapper
    
    return html;
}

export function ExportTreeData(): any {
    return {
        tree: serializeNode(treeRoot),
        recipeMemory: Array.from(recipeMemory.entries()),
        oreDictMemory: Array.from(oreDictMemory.entries())
    };
}

function serializeNode(node: TreeNodeData | null): any {
    if (!node) return null;
    
    return {
        goodsId: node.goods.id,
        amount: node.amount,
        recipeId: node.recipe?.id || null,
        voltageTier: node.voltageTier,
        expanded: node.expanded,
        children: node.children.map(child => serializeNode(child))
    };
}

export function ImportTreeData(data: any) {
    if (!data) return;
    
    nextTreeIid = 0;
    
    // Import recipe and ore dict memory if present
    if (data.recipeMemory && Array.isArray(data.recipeMemory)) {
        recipeMemory.clear();
        data.recipeMemory.forEach(([goodsId, recipeId]: [string, string]) => {
            recipeMemory.set(goodsId, recipeId);
        });
    }
    
    if (data.oreDictMemory && Array.isArray(data.oreDictMemory)) {
        oreDictMemory.clear();
        data.oreDictMemory.forEach(([oreDictId, goodsId]: [string, string]) => {
            oreDictMemory.set(oreDictId, goodsId);
        });
    }
    
    // Import tree structure - handle both old and new format
    const treeData = data.tree || data;
    treeRoot = deserializeNode(treeData);
    scheduleRender();
}

function deserializeNode(data: any): TreeNodeData | null {
    if (!data) return null;
    
    const goods = Repository.current.GetById<Goods>(data.goodsId);
    if (!goods || !goods.name) return null;
    
    const node: TreeNodeData = {
        iid: nextTreeIid++,
        goods: goods,
        amount: data.amount || 1,
        recipe: data.recipeId ? Repository.current.GetById<Recipe>(data.recipeId) : null,
        voltageTier: data.voltageTier || 0,
        children: [],
        expanded: data.expanded || false,
        satisfied: data.recipeId !== null
    };
    
    if (data.children && Array.isArray(data.children)) {
        node.children = data.children
            .map((childData: any) => deserializeNode(childData))
            .filter((child: TreeNodeData | null) => child !== null) as TreeNodeData[];
    }
    
    return node;
}

import { ShowNei, ShowNeiMode, ShowNeiCallback } from "./nei.js";
import { Goods, Repository, Item, Fluid, Recipe, RecipeIoType, OreDict } from "./repository.js";
import { IconBox } from "./itemIcon.js";
import { ShowTooltip } from "./tooltip.js";
import { formatAmount, voltageTier } from "./utils.js";
import { UpdateProject, page } from "./page.js";
import { machines, GetSingleBlockMachine } from "./machines.js";

export type TreeNodeData = {
    iid: number;
    goods: Goods;
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
                renderTree();
                saveTreeToPage();
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
    
    const outputAmount = node.recipe.items
        .filter(item => item.type === RecipeIoType.ItemOutput || item.type === RecipeIoType.FluidOutput)
        .find(item => item.goods.id === node.goods.id)?.amount || 1;
    
    const recipesNeeded = node.amount / outputAmount;
    
    for (const child of node.children) {
        const inputItem = node.recipe.items.find(item => item.goods.id === child.goods.id);
        if (inputItem) {
            child.amount = inputItem.amount * recipesNeeded;
        }
    }
}

export function SetTreeRoot(goods: Goods, amount: number = 1) {
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
    renderTree();
    saveTreeToPage();
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
    renderTree();
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
    if (!node.oreDictSource || node.oreDictSource.items.length <= 1) return;
    
    // Show alert listing options
    let message = `Select variant for ${node.oreDictSource.name}:\n\n`;
    node.oreDictSource.items.forEach((item, index) => {
        message += `${index + 1}. ${item.name}\n`;
    });
    message += `\nCurrent: ${node.goods.name}`;
    
    const choice = prompt(message + "\n\nEnter number (1-" + node.oreDictSource.items.length + "):");
    if (choice) {
        const index = parseInt(choice) - 1;
        if (index >= 0 && index < node.oreDictSource.items.length) {
            const newGoods = node.oreDictSource.items[index];
            oreDictMemory.set(node.oreDictSource.id, newGoods.id);
            // Update this node and rebuild parent
            node.goods = newGoods;
            node.recipe = null;
            node.satisfied = false;
            node.children = [];
            renderTree();
            saveTreeToPage();
        }
    }
}

function applyRecipeToAllMatchingNodes(goodsId: string, recipe: Recipe) {
    function traverseAndApply(node: TreeNodeData | null) {
        if (!node) return;
        
        // If this node has the same goods and doesn't already have this recipe
        if (node.goods.id === goodsId && node.recipe?.id !== recipe.id) {
            node.recipe = recipe;
            node.satisfied = true;
            node.expanded = true;
            node.children = [];
            buildNodeChildren(node);
        }
        
        // Recursively check children
        for (const child of node.children) {
            traverseAndApply(child);
        }
    }
    
    traverseAndApply(treeRoot);
}

function setNodeRecipe(node: TreeNodeData, recipe: Recipe) {
    node.recipe = recipe;
    node.satisfied = true;
    node.expanded = true;
    
    // Remember this recipe choice for this goods
    recipeMemory.set(node.goods.id, recipe.id);
    
    // Apply this recipe to all other nodes in the tree with the same goods
    applyRecipeToAllMatchingNodes(node.goods.id, recipe);
    
    // Build children from recipe inputs
    node.children = [];
    
    // Calculate output amount - works for both GT and non-GT recipes
    const outputAmount = recipe.items
        .filter(item => item.type === RecipeIoType.ItemOutput || item.type === RecipeIoType.FluidOutput)
        .find(item => item.goods.id === node.goods.id)?.amount || 1;
    
    const recipesNeeded = node.amount / outputAmount;
    
    // Group inputs by goods ID to combine duplicates
    const inputMap = new Map<string, { goods: Goods, amount: number, oreDictSource?: OreDict }>();
    
    // Add all inputs as children (excluding programmed circuits)
    for (const item of recipe.items) {
        if (item.type === RecipeIoType.ItemInput || 
            item.type === RecipeIoType.FluidInput ||
            item.type === RecipeIoType.OreDictInput) {
            
            let goods = item.goods as Goods;
            let oreDictSource: OreDict | undefined = undefined;
            
            // Skip programmed circuits
            if (goods.name && goods.name.includes("Programmed Circuit")) {
                continue;
            }
            
            // For ore dictionary, check memory or use first variant
            if (item.type === RecipeIoType.OreDictInput && goods instanceof OreDict) {
                oreDictSource = goods; // Store the original ore dict
                if (goods.items.length > 0) {
                    // Check if we have a remembered choice
                    const rememberedId = oreDictMemory.get(goods.id);
                    if (rememberedId) {
                        const rememberedGoods = Repository.current.GetById<Goods>(rememberedId);
                        if (rememberedGoods) {
                            goods = rememberedGoods;
                        } else {
                            goods = goods.items[0];
                        }\n                    } else {
                        goods = goods.items[0]; // Use first item by default
                    }
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
            satisfied: false,
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
    
    console.log('✓ Created', node.children.length, 'children for:', node.goods.name);
    
    renderTree();
    saveTreeToPage();
}

function buildNodeChildren(node: TreeNodeData) {
    if (!node.recipe) return;
    
    const recipe = node.recipe;
    const outputAmount = recipe.items
        .filter(item => item.type === RecipeIoType.ItemOutput || item.type === RecipeIoType.FluidOutput)
        .find(item => item.goods.id === node.goods.id)?.amount || 1;
    
    const recipesNeeded = node.amount / outputAmount;
    
    // Group inputs by goods ID to combine duplicates
    const inputMap = new Map<string, { goods: Goods, amount: number }>();
    
    for (const item of recipe.items) {
        if (item.type === RecipeIoType.ItemInput || 
            item.type === RecipeIoType.FluidInput ||
            item.type === RecipeIoType.OreDictInput) {
            
            let goods = item.goods as Goods;
            
            if (goods.name && goods.name.includes("Programmed Circuit")) {
                continue;
            }
            
            if (item.type === RecipeIoType.OreDictInput && goods instanceof OreDict) {
                if (goods.items.length > 0) {
                    goods = goods.items[0];
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
                buildNodeChildren(childNode);
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
    
    renderTree();
    saveTreeToPage();
}

function cycleVoltageTier(iid: number) {
    const node = findNodeByIid(iid);
    if (!node || !node.recipe) return;
    
    node.voltageTier = (node.voltageTier + 1) % voltageTier.length;
    
    // Update children voltage tiers
    for (const child of node.children) {
        child.voltageTier = node.voltageTier;
    }
    
    renderTree();
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
                const oreDictTitle = child.oreDictSource ? ` (Right-click to change variant from ${child.oreDictSource.items.length} options)` : '';
                html += `<div class="tree-recipe-slot ${oreDictClass}" data-tree-iid="${child.iid}" title="Click to select recipe for ${child.goods.name}${oreDictTitle}">`;
                html += `<item-icon data-id="${child.goods.id}"></item-icon>`;
                html += `<span class="tree-slot-amount">${formatAmount(child.amount)}</span>`;
                if (child.recipe) {
                    html += `<span class="tree-slot-has-recipe">✓</span>`;
                }
                if (child.oreDictSource && child.oreDictSource.items.length > 1) {
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
        console.log('→ Rendering', node.children.length, 'children with CSS class:', cssClass);
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
    return serializeNode(treeRoot);
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
    treeRoot = deserializeNode(data);
    renderTree();
}

function deserializeNode(data: any): TreeNodeData | null {
    if (!data) return null;
    
    const goods = Repository.current.GetById<Goods>(data.goodsId);
    if (!goods) return null;
    
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

import { page, addProjectChangeListener, UpdateProject } from "./page.js";
import { InitializeTreeView, SetTreeRoot, GetTreeRoot, ExportTreeData, ImportTreeData } from "./treeView.js";
import { ShowNei, ShowNeiMode, ShowNeiCallback } from "./nei.js";
import { Goods, Repository } from "./repository.js";

let currentMode: "recipe-list" | "tree-view" = "recipe-list";
const recipeListView = document.getElementById("recipe-list")!;
const treeView = document.getElementById("tree-view")!;
const modeRecipeListBtn = document.getElementById("mode-recipe-list")!;
const modeTreeViewBtn = document.getElementById("mode-tree-view")!;
const treeSelectRootBtn = document.getElementById("tree-select-root")!;

export function InitializeModeManager() {
    InitializeTreeView();
    
    // Set up mode switching
    modeRecipeListBtn.addEventListener("click", () => switchMode("recipe-list"));
    modeTreeViewBtn.addEventListener("click", () => switchMode("tree-view"));
    
    // Set up tree root selection
    treeSelectRootBtn.addEventListener("click", showRootSelection);
    
    // Listen for page changes to sync tree data
    addProjectChangeListener(() => {
        if (currentMode === "tree-view") {
            page.treeData = ExportTreeData();
        }
    });
    
    // Load initial mode from page settings
    if (page.settings.viewMode) {
        switchMode(page.settings.viewMode);
    }
}

function switchMode(mode: "recipe-list" | "tree-view") {
    currentMode = mode;
    page.settings.viewMode = mode;
    
    if (mode === "recipe-list") {
        recipeListView.classList.remove("hidden");
        treeView.classList.add("hidden");
        modeRecipeListBtn.classList.add("active");
        modeTreeViewBtn.classList.remove("active");
        
        // Save tree data when leaving tree mode
        if (GetTreeRoot()) {
            page.treeData = ExportTreeData();
        }
    } else {
        recipeListView.classList.add("hidden");
        treeView.classList.remove("hidden");
        modeRecipeListBtn.classList.remove("active");
        modeTreeViewBtn.classList.add("active");
        
        // Load tree data when entering tree mode
        if (page.treeData) {
            ImportTreeData(page.treeData);
        }
    }
    
    UpdateProject(true); // Visual update only
}

function showRootSelection() {
    const callback: ShowNeiCallback = {
        onSelectGoods: (goods: Goods) => {
            SetTreeRoot(goods, 1);
        }
    };
    
    ShowNei(null, ShowNeiMode.Production, callback);
}

export function GetCurrentMode(): "recipe-list" | "tree-view" {
    return currentMode;
}
